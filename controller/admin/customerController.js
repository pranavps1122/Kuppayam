const User = require('../../model/userSchema')
const Order =require('../../model/orderSchema');
const { Product } = require('../../model/productSchema');





const customerInfo = async (req,res)=>{
    try {
        

        let search =""
        if(req.query.search){
            search=req.query.search;

        }

        let page = parseInt(req.query.page) || 1;
        const limit = 5;

        const userData = await User.find({
            isAdmin:false,
            $or:[
                {name:{$regex:'.*'+search+'.*'}},
                {email:{$regex:'.*'+search+'.*'}}
            ]
        })

        .limit(limit)
        .skip((page-1)*limit)
        .exec();

        const count = await User.find({
            isAdmin:false,
            $or:[
                {name:{$regex:'.*'+search+'.*'}},
                {email:{$regex:'.*'+search+'.*'}}
            ]
        }).countDocuments();

        const totalPages = Math.ceil(count / limit);


        
        res.render('customers', { user: req.session.admin, users: userData, search: search, count: count, totalPages: totalPages, currentPage: page });

    } catch (error) {
        console.log(error)
        res.redirect('/adminError');
    }
}

const loadOrderManagement = async (req,res)=>{
    const page = parseInt(req.query.page) || 1; 
    const limit = 5; 
    const skip = (page - 1) * limit;

    const totalProducts = await Product.countDocuments(); 
    const totalPages = Math.ceil(totalProducts / limit);

    try {
        const orders = await Order.find().populate('orderedItem.productId')
        
        .skip(skip)
        .limit(limit);
        res.render('orderManage',{
            orders,
            currentPage: page,
            totalPages
        })
        console.log('orders',orders)
    } catch (error) {
        console.log('error while rendering ordermanagemnt',error)
    }
}



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


module.exports={
    customerInfo,
    loadOrderManagement,
    updateOrderStatus
}
