const User = require('../../model/userSchema')
const Order =require('../../model/orderSchema');
const { Product } = require('../../model/productSchema');
const Wallet = require('../../model/walletSchema')
const Coupon = require('../../model/couponSchema')
const Offer = require('../../model/offerSchema');
const Category = require('../../model/categorySchema');
const { Status } = require('./productController');

const customerInfo = async (req, res) => {
    try {
        if (!req.session.admin) {
            return res.redirect('/admin/login');
        }

        // Get search and pagination parameters
        const search = req.query.search || '';
        const page = parseInt(req.query.page) || 1;
        const limit = 5; // Number of users per page

        // Build search query for users (not admin)
        let query = { isAdmin: false };
        if (search) {
            query = {
                isAdmin: false,
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            };
        }

        // Count total users matching the search criteria
        const totalUsers = await User.countDocuments(query);
        const totalPages = Math.ceil(totalUsers / limit);

        // Fetch users with pagination
        const users = await User.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .select('_id name email Status'); // Select only needed fields

        // Log for debugging
        console.log('Search Query:', search);
        console.log('Total Users Found:', totalUsers);
        console.log('Users:', users);

        res.render('customers', {
            user: req.session.admin,
            users,
            currentPage: page,
            totalPages,
            search,
            totalUsers,
            admin: req.session.admin,
            active: 'users'
        });

    } catch (error) {
        console.error('Error in customerInfo:', error);
        res.redirect('/adminError');
    }
};

const loadOrderManagement = async (req, res) => {
    const page = parseInt(req.query.page) || 1; 
    const limit = 5; 
    const skip = (page - 1) * limit;

    try {
        // Count total orders for pagination
        const totalOrders = await Order.countDocuments(); 
        const totalPages = Math.ceil(totalOrders / limit);

        // Fetch orders with pagination and populate ordered items
        const orders = await Order.find()
            .populate({
                path: 'orderedItem.productId',
                model: 'Product',
                select: 'productName productImage price'
            })
            
            .sort({ createdAt: -1 }) // Sort by creation date, latest first
            .skip(skip)
            .limit(limit);
            console.log('orders',orders)

        res.render('orderManage', {
            orders,
            currentPage: page,
            totalPages,
            admin: req.session.admin, // Ensure admin data is passed correctly
            active: 'orders'  
        });
    } catch (error) {
        console.log('Error while rendering order management:', error);
        res.status(500).send('Internal Server Error');
    }
};

const updateOrderStatus = async (req,res)=>{
    try {
        const { orderId, productId,status } = req.body;
   
        const order = await Order.updateOne(
            { _id: orderId, "orderedItem.productId": productId }, 
            { $set: { "orderedItem.$.productStatus": status } } 
        );
        
        res.redirect('/admin/ordermanagement')
        
      
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ success: false, message: 'An error occurred', error });
    }
    
}

const loadOrderDetails = async (req, res) => {
    const orderId = req.params.orderId;

    try {
        const order = await Order.findById(orderId)
            .populate({
                path: 'orderedItem.productId',
                model: 'Product',
                select: 'productName productImage price'
            });

        if (!order) {
            return res.status(404).send('Order not found');
        }

        res.render('AdminorderDetails', { order, admin: req.session.admin, 
            active: 'order'   });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).send('Internal Server Error');
    }
};

const updateProductStatus = async (req, res) => {
    const { orderId, productId, status } = req.body;



    try {
       
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).send('Order not found');
        }

       
        const item = order.orderedItem.find(item => item.productId.toString() === productId);
        if (!item) {
            console.error('Product not found in order:', order.orderedItem);
            return res.status(404).send('Product not found in order');
        }

        item.productStatus = status;
        await order.save(); 

        res.redirect(`/admin/orderDetails/${orderId}`); 
    } catch (error) {
        console.error('Error updating product status:', error);
        res.status(500).send('Internal Server Error');
    }
};

const returnApprove = async (req, res) => {
    try {
        const orderId = req.params.orderid;
        const productId = req.params.productid;

        const order = await Order.findById(orderId).populate('orderedItem.productId');
        if (!order) return res.status(404).send('Order not found');

        const itemToReturn = order.orderedItem.find(item => item.productId._id.toString() === productId);
        if (!itemToReturn) return res.status(404).send('Product not found in order');

        const totalQuantity = order.orderedItem.reduce((sum, item) => sum + item.quantity, 0);

      
        let refundAmount;
        if (order.couponCode) {
            refundAmount = (order.orderAmount / totalQuantity) * itemToReturn.quantity;
        } else {
            refundAmount = itemToReturn.productPrice * itemToReturn.quantity;
        }

        console.log(`Refund Amount for ${itemToReturn.productId._id}: ${refundAmount}`);

    
        const product = await Product.findById(productId);
        if (product) {
            const sizeIndex = product.stock.findIndex(stock => stock.size == itemToReturn.size);
            if (sizeIndex !== -1) {
                product.stock[sizeIndex].quantity += itemToReturn.quantity;
                product.totalStock += itemToReturn.quantity;
                await product.save();
            }
        }

       
        let wallet = await Wallet.findOne({ userId: order.userId });
        if (!wallet) {
            wallet = new Wallet({ userId: order.userId, balance: 0, transactions: [] });
        }
        wallet.balance += refundAmount;
        wallet.transactions.push({
            amount: refundAmount,
            transactionsMethod: 'Refund',
            date: new Date(),
            orderId: orderId
        });
        await wallet.save();

     
        itemToReturn.productStatus = 'Returned';
        await order.save();

        res.redirect('/admin/ordermanagement'); 
    } catch (error) {
        console.error('Error approving return:', error);
        res.status(500).send('Error processing return approval');
    }
};

const returnDecline = async (req,res)=>{
    try {
        const orderId = req.params.orderid;
        const productId = req.params.productid;

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).send('Order not found');

        const itemToReturn = order.orderedItem.find(item => item.productId._id.toString() === productId);
        if (!itemToReturn) return res.status(404).send('Product not found in order');

     
        itemToReturn.productStatus = 'Return Declined';
        await order.save();

        res.redirect('/admin/ordermanagement'); 
    } catch (error) {
        console.error('Error declining return:', error);
        res.status(500).send('Error processing return decline');
    }
}

const LoadCouponManagement = async (req,res)=>{
    try {
        const coupon = await Coupon.find()
        console.log('coupon',coupon)
        res.render('couponManagement',{
            admin: req.session.admin, 
            active: 'coupons' ,
            coupon:coupon,
            message:null 
        })
    } catch (error) {
        console.log('error while loading couponManagement',error)
    }
}

const addCoupon = async (req,res)=>{
    try {
        const coupon = await Coupon.find()
        const { code, discount, minimumPrice, maxRedeem, expiry } = req.body;
        console.log('req.body',req.body)
        
        if(!code||!discount||!minimumPrice||!maxRedeem||!expiry){
            return res.render('couponManagement', {
                message: { text: 'All fields are required', type: 'error' },
                admin: req.session.admin,
                active: 'coupons',
                
            });
        }

        
        const newCoupon = new Coupon({
            couponCode:code,
            discount:discount,
            minimumPrice:minimumPrice,
            maxRedeem:maxRedeem,
            expiry:expiry,
            status:true
        })

        await newCoupon.save();
        const updatedCoupon = await Coupon.find()

        return res.render('couponManagement', {
            message: { text: 'Coupon created successfully', type: 'success' },
            admin: req.session.admin,
            active: 'coupons',
            coupon:updatedCoupon
        });
    } catch (error) {
        console.log('error while creating coupons',error)   
    }
}

const deleteCoupon = async (req,res)=>{
    try {
        const couponId=req.params.id
        const coupon = await Coupon.findOne({_id:couponId})

        const togglestatus = coupon.status==true?false:true

        await Coupon.findOneAndUpdate({_id:couponId},{
            $set:{
                status:togglestatus
            }
        },{new:true})
        
    
        res.redirect('/admin/couponManagement')
      
        
    } catch (error) {
        console.log('error while delete coupon',error)
    }
}

        const editCoupon = async (req,res)=>{

            try {
                console.log(req.body)
                const {couponId,code,minimumPrice,maxRedeem,expiry,discount}=req.body
                await Coupon.findOneAndUpdate({_id:couponId},{
                    $set:{
                       couponCode:code,
                       discount:discount,
                       minimumPrice:minimumPrice,
                       maxRedeem:maxRedeem,
                       expiry:expiry
                    }
                },
            {new:true})
            res.redirect('/admin/couponManagement')
            } catch (error) {
            console.log('error while editing coupon',error) 
            }
        }

const LoadOfferManagement = async (req, res) => {
    try {
        const products = await Product.find({ isActive: true });
        const categories = await Category.find({ isActive: true });

        const offers = await Offer.find().populate('productId').populate('categoryId'); 
        
        console.log('products', products);
        console.log('offers', offers);

        res.render('offerManagement', {
            admin: req.session.admin,
            active: 'offers',
            message: null,
            offers: offers,
            products: products,
            categories: categories 
        });
    } catch (error) {
        console.log('error while loading offer', error);
        res.render('offerManagement', {
            admin: req.session.admin,
            active: 'offers',
            message: { text: 'Error loading offers', type: 'error' },
            offers: [],
            products: [],
            categories: []
        });
    }
};


            const addOffer = async (req, res) => {
                try {
                    const offers = await Offer.find().populate('productId');
                    const product = await Product.find({ isActive: true });
                    const categories = await Category.find({ isActive: true });

                    const { offerType, discount, startDate, endDate, productId, categoryId, referralCode } = req.body;

                    if (!offerType || !discount || !startDate || !endDate) {
                        return res.render('offerManagement', {
                            message: { text: 'Offer adding failed: Missing required fields', type: 'error' },
                            admin: req.session.admin,
                            active: 'offers',
                            offers,
                            products: product,
                            categories
                        });
                    }

                    let offerData = {
                        offerType,
                        discount,
                        startDate,
                        endDate,
                        status: true
                    };

                    if (offerType === "product") {
                        if (!productId || productId.trim() === "") {
                            return res.render('offerManagement', {
                                message: { text: 'Product ID is required for product-type offers', type: 'error' },
                                admin: req.session.admin,
                                active: 'offers',
                                offers,
                                products: product,
                                categories
                            });
                        }
                        offerData.productId = productId;
                    }

                    if (offerType === "category") {
                        if (!categoryId || categoryId.trim() === "") {
                            return res.render('offerManagement', {
                                message: { text: 'Category ID is required for category-type offers', type: 'error' },
                                admin: req.session.admin,
                                active: 'offers',
                                offers,
                                products: product,
                                categories
                            });
                        }
                        offerData.categoryId = categoryId;
                    }

                    if (offerType === "referral") {
                        if (!referralCode || referralCode.trim() === "") {
                            return res.render('offerManagement', {
                                message: { text: 'Referral Code is required for referral-type offers', type: 'error' },
                                admin: req.session.admin,
                                active: 'offers',
                                offers,
                                products: product,
                                categories
                            });
                        }

                      
                        const isCodeValid = await Referral.findOne({ code: referralCode });

                        if (!isCodeValid) {
                            return res.render('offerManagement', {
                                message: { text: 'Invalid referral code', type: 'error' },
                                admin: req.session.admin,
                                active: 'offers',
                                offers,
                                products: product,
                                categories
                            });
                        }

                        offerData.referralCode = referralCode;
                    }

                    const newOffer = new Offer(offerData);
                    await newOffer.save();

                    const updatedOffers = await Offer.find().populate('productId').populate('categoryId');

                    return res.render('offerManagement', {
                        message: { text: 'Offer added successfully', type: 'success' },
                        admin: req.session.admin,
                        active: 'offers',
                        offers: updatedOffers,
                        products: product,
                        categories
                    });

                } catch (error) {
                    console.log('Error while adding offer:', error);
                }
            };

        const deleteOffer = async (req,res)=>{
            try {
                
                const offerId = req.params.id
                console.log('offerId',offerId) 
                const product = await Product.find({ isActive: true });
                const categories = await Category.find({ isActive: true });
                const offer = await Offer.findOne({_id:offerId})
                console.log('offfer finded',offer)
            const newStatus= offer.status ===true?false:true

            await Offer.findOneAndUpdate(
                { _id: offerId },
                { $set: { status: newStatus } }
            );

            
            

        
      res.redirect('/admin/offerManagement')
        
    } catch (error) {
        console.log('error while deleting offer',error) 
    }
}

    const catDelete = async (req,res)=>{

        try {
    
            const product = await Product.find({ isActive: true });
            const categories = await Category.find({ isActive: true });
            const offerId=req.params.id
            console.log('category id',offerId)
        
            const offer = await Offer.findOne({_id:offerId})
            
            const togglestatus=offer.status===true?false:true

            await Offer.findOneAndUpdate({_id:offerId},{
                $set:{status:togglestatus}},
                
        )
        res.redirect('/admin/offerManagement')
        
        } catch (error) {
            console.log('error while deleting',error)
        }
    }

const editCategoryOffer = async (req,res)=>{

    try {
        const product = await Product.find({ isActive: true });
        const categories = await Category.find({ isActive: true });
        const offer = await Offer.find()
        const categoryId = req.params.id
        console.log(req.body)
        const {discount,startDate,endDate}=req.body

        console.log('CategoryId',categoryId)
        const updatedCategoryOffer = await Offer.findOneAndUpdate({categoryId:categoryId},
            {$set:{discount:discount,startDate:startDate,endDate:endDate}},
            {new:true}

        )

           
     
        return res.render('offerManagement',{
            message: { text: 'Offer updated succesfully', type: 'success' },
            admin: req.session.admin,
            active: 'offers',
            offers:offer,
            products: product, 
            categories
        });

        
        
        
        
    } catch (error) {
        console.log('error while editing Categoryoffer',error)
    }
}

const editProductOffer = async (req,res)=>{

    try {
        const product = await Product.find({ isActive: true });
        const categories = await Category.find({ isActive: true });
        const offer = await Offer.find()
        const productId = req.params.id
        const {discount,startDate,endDate}=req.body

        await Offer.findOneAndUpdate({productId:productId},{
            $set:{discount:discount,startDate:startDate,endDate:endDate}
        },{new:true})

        return res.render('offerManagement',{
            message: { text: 'Offer updated succesfully', type: 'success' },
            admin: req.session.admin,
            active: 'offers',
            offers:offer,
            products: product, 
            categories
        });

        
    } catch (error) {
        console.log('error while editing productOffer',error)
    }
}









module.exports={
    customerInfo,
    loadOrderManagement,
    updateOrderStatus,
    loadOrderDetails,
    updateProductStatus,
    returnApprove,
    returnDecline,
    LoadCouponManagement,
    addCoupon,
    deleteCoupon,
    LoadOfferManagement,
    addOffer,
    deleteOffer,
    catDelete,
    editCategoryOffer,
    editProductOffer,
    editCoupon
 
 
   
}
