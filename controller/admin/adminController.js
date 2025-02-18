    const User = require('../../model/userSchema')
    const mongoose = require('mongoose')
    const bcrypt = require('bcrypt')
    const { session } = require('passport')
    const Order=require('../../model/orderSchema')
    const { Product } = require('../../model/productSchema');
    const Category=require('../../model/categorySchema')

    const adminError = async (req,res)=>{
        res.render('adminError')
    }

    const loadLogin = (req,res)=>{
        if(req.session.admin){
            return res.redirect('/admin/dashboard')
        }
        res.render('admin-login',{message:null})
    }

    const login = async (req,res) =>{
        try {
            const {email,password}=req.body
            const admin = await User.findOne({email,isAdmin:true})
            if(admin){
                const passwordMatch = await bcrypt.compare(password,admin.password);
                if(passwordMatch){
                    req.session.admin = { _id: admin._id, name: admin.name }
                    req.session.isAdmin=true
                    return res.redirect('/admin/dashboard-stats')
                }else{
                    return res.render('admin-login',
                        {message:'Password not maching'})
                }
            }else{
                return res.render('admin-login', {message:'Email not matching'})
            }
        } catch (error) {
            return res.redirect('/pageNotFound')
        }
    }

    const loadDashboard = async (req, res) => {
        if (!req.session.admin) {
            return res.redirect('/admin/login');
        }
    
        try {
            console.log("Starting dashboard data fetch...");
    
        
            const totalRevenueData = await Order.aggregate([
                { $unwind: "$orderedItem" },
                { $match: { "orderedItem.productStatus": "delivered" } },
                { 
                    $group: { 
                        _id: null, 
                        totalRevenue: { $sum: "$orderAmount" },
                        totalProfit: { $sum: { $ifNull: ["$profit", 0] } }
                    }
                }
            ]);
            console.log("Revenue data:", totalRevenueData);
    
            const totalRevenue = totalRevenueData.length ? totalRevenueData[0].totalRevenue : 0;
            const totalProfit = totalRevenueData.length ? totalRevenueData[0].totalProfit : 0;
    
         
            const currentYear = new Date().getFullYear();
            const salesData = await Order.aggregate([
                { $unwind: "$orderedItem" },
                { $match: { 
                    "orderedItem.productStatus": "delivered",
                    "date": { 
                        $gte: new Date(currentYear, 0, 1),
                        $lte: new Date(currentYear, 11, 31)
                    }
                }},
                {
                    $group: {
                        _id: { month: { $month: "$date" } },
                        revenue: { $sum: "$orderAmount" },
                        profit: { $sum: { $ifNull: ["$profit", 0] } }
                    }
                },
                { $sort: { "_id.month": 1 } }
            ]);
    
         
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const formattedSalesData = {
                labels: monthNames,
                values: new Array(12).fill(0),
                profits: new Array(12).fill(0)
            };
    
        
            salesData.forEach(item => {
                const monthIndex = item._id.month - 1;
                formattedSalesData.values[monthIndex] = item.revenue;
                formattedSalesData.profits[monthIndex] = item.profit;
            });
    
       
            const topProducts = await Order.aggregate([
                { $unwind: "$orderedItem" },
                { $match: { "orderedItem.productStatus": "delivered" } },
                {
                    $group: {
                        _id: "$orderedItem.productId",
                        totalSales: { $sum: "$orderedItem.quantity" },
                        revenue: { $sum: "$orderedItem.totalProductPrice" }
                    }
                },
                { $sort: { totalSales: -1 } },
                { $limit: 5 },
                {
                    $lookup: {
                        from: "products",
                        localField: "_id",
                        foreignField: "_id",
                        as: "productDetails"
                    }
                },
                {
                    $project: {
                        productName: { $arrayElemAt: ["$productDetails.productName", 0] },
                        totalSales: 1,
                        revenue: 1
                    }
                }
            ]);
    
            
            const totalOrders = await Order.countDocuments();
            const totalProducts = await Product.countDocuments();
            const activeProducts = await Product.countDocuments({ isActive: true });
    
          
            const categoryData = await Category.aggregate([
                {
                    $lookup: {
                        from: "products",
                        localField: "_id",
                        foreignField: "category",
                        as: "products"
                    }
                },
                {
                    $project: {
                        name: "$categoryName",
                        count: { $size: "$products" }
                    }
                }
            ]);
    
            const formattedCategoryData = {
                labels: categoryData.map(cat => cat.name),
                values: categoryData.map(cat => cat.count)
            };
    
       
            const topCategories = await Order.aggregate([
                { $unwind: "$orderedItem" },
                { $match: { "orderedItem.productStatus": "delivered" } },
                {
                    $lookup: {
                        from: "products",
                        localField: "orderedItem.productId",
                        foreignField: "_id",
                        as: "product"
                    }
                },
                { $unwind: "$product" },
                {
                    $lookup: {
                        from: "categories",
                        localField: "product.category",
                        foreignField: "_id",
                        as: "category"
                    }
                },
                { $unwind: "$category" },
                {
                    $group: {
                        _id: "$category._id",
                        name: { $first: "$category.categoryName" },
                        totalSales: { $sum: "$orderedItem.quantity" },
                        revenue: { $sum: "$orderedItem.totalProductPrice" }
                    }
                },
                {
                    $addFields: {
                        growth: 0 
                    }
                },
                { $sort: { totalSales: -1 } },
                { $limit: 10 }
            ]);
    
            const dashboardData = {
                totalRevenue,
                totalProfit,
                totalOrders,
                totalProducts,
                activeProducts,
                topProducts,
                salesData: formattedSalesData,
                categoryData: formattedCategoryData,
                topCategories
            };
            console.log("Final dashboard data:", dashboardData);
    
          
            if (req.xhr || req.headers.accept.includes('application/json')) {
                console.log("Sending JSON response");
                return res.json(dashboardData);
            }
    
           
            console.log("Rendering dashboard template");
            return res.render('admin-dashboard', {
                ...dashboardData,
                admin: req.session.admin,
                active: 'dashboard'
            });
    
        } catch (error) {
            console.error("Error in loadDashboard:", error);
            if (req.xhr || req.headers.accept.includes('application/json')) {
                return res.status(500).json({ 
                    error: "Server error", 
                    details: error.message 
                });
            }
            res.status(500).render('error', { error: "An error occurred loading the dashboard" });
        }
    };
    
    

    const logout = async (req,res)=>{
        try {
            req.session.destroy(err=>{
                if(err){
                    return res.redirect('/adminError')
                }else{
                    res.redirect('/admin/login')
                }
            })
        } catch (error) {
            res.redirect('/adminError')
        }
    }

    const loadCustomers = async (req, res) => {
        try {
            if (!req.session.admin) {
                return res.redirect('/admin/login');
            }
            const users = await User.find({ isAdmin: false });
            res.render('customers', { user: req.session.admin, users });
        } catch (error) {
            return res.redirect('/adminError');
        }
    };
    const blockCustomer = async (req, res) => {
        try {
            const userId = req.query.userId;
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.redirect('/adminError'); 
            }
         
            const user = await User.findById(userId);
            if (!user) {
                return res.redirect('/adminError');
            }
    
         
            const updatedUser = await User.findByIdAndUpdate(
                userId,
                { $set: { Status: !user.Status } },
                { new: true } 
            );
    
           
            res.redirect('/admin/customers');
        } catch (error) {
            console.error('Error blocking/unblocking user:', error);
            res.redirect('/adminError');
        }
    };
    
    
    
    module.exports ={
        loadLogin,
        login,
        loadDashboard,
        adminError,
        logout,
        loadCustomers,
        blockCustomer,
    }