const User = require('../../model/userSchema')
const Order =require('../../model/orderSchema');
const { Product } = require('../../model/productSchema');
const Wallet = require('../../model/walletSchema')
const Coupon = require('../../model/couponSchema')
const Offer = require('../../model/offerSchema')




const customerInfo = async (req,res)=>{
    try {
        const userId = req.session.userId; // Assuming you have user ID in session
        const search = req.query.search || '';
        const page = parseInt(req.query.page) || 1;
        const limit = 5; // Number of orders per page

        // Fetch orders for the user, sorted by createdAt in descending order
        const users = await User.find({ /* your query here */ }); // Ensure you are fetching users correctly

        // Log the users to check if it's an array
        console.log('Fetched users:', users);

        const orders = await Order.find({ userId: userId, $or: [{ orderId: { $regex: search, $options: 'i' } }] })
            .sort({ createdAt: -1 }) // Sort by creation date, latest first
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('orderedItem.productId'); // Populate product details if needed

        const count = await Order.countDocuments({ userId: userId, $or: [{ orderId: { $regex: search, $options: 'i' } }] });
        const totalPages = Math.ceil(count / limit);

        res.render('customers', {
            user: req.session.admin,
            users: users, // Pass the users array to the template
            orders: orders,
            search: search,
            totalPages: totalPages,
            currentPage: page,
            admin: req.session.admin, // Ensure admin data is passed correctly
            active: 'users'  
        });
    } catch (error) {
        console.error('Error fetching customer orders:', error);
        res.redirect('/adminError');
    }
}

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

        res.render('AdminorderDetails', { order, admin: req.session.admin, // Ensure admin data is passed correctly
            active: 'order'   });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).send('Internal Server Error');
    }
};

const updateProductStatus = async (req, res) => {
    const { orderId, productId, status } = req.body;

    console.log('Received orderId:', orderId);
    console.log('Received productId:', productId);
    console.log('Received status:', status);

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

const returnApprove = async (req,res)=>{

    try {
        const orderId = req.params.orderid;
        const productId = req.params.productid;

        const order = await Order.findById(orderId).populate('orderedItem.productId');
        if (!order) return res.status(404).send('Order not found');

        const itemToReturn = order.orderedItem.find(item => item.productId._id.toString() === productId);
        if (!itemToReturn) return res.status(404).send('Product not found in order');

        // Process refund and update stock
        const refundAmount = itemToReturn.productPrice * itemToReturn.quantity;
        const product = await Product.findById(productId);
        if (product) {
            const sizeIndex = product.stock.findIndex(stock => stock.size == itemToReturn.size);
            if (sizeIndex !== -1) {
                product.stock[sizeIndex].quantity += itemToReturn.quantity;
                product.totalStock += itemToReturn.quantity;
                await product.save();
            }
        }

        // Update wallet balance
        let wallet = await Wallet.findOne({ userId: order.userId });
        if (!wallet) {
            wallet = new Wallet({ userId: order.userId, balance: 0, transactions: [] });
            await wallet.save();
        }
        wallet.balance += refundAmount;
        wallet.transactions.push({
            amount: refundAmount,
            transactionsMethod: 'Refund',
            date: new Date(),
            orderId: orderId
        });
        await wallet.save();

        // Update order status
        itemToReturn.productStatus = 'Returned';
        await order.save();

        res.redirect('/admin/ordermanagement'); // Redirect to orders page after approval
    } catch (error) {
        console.error('Error approving return:', error);
        res.status(500).send('Error processing return approval');
    }


}



const returnDecline = async (req,res)=>{


    try {
        const orderId = req.params.orderid;
        const productId = req.params.productid;

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).send('Order not found');

        const itemToReturn = order.orderedItem.find(item => item.productId._id.toString() === productId);
        if (!itemToReturn) return res.status(404).send('Product not found in order');

        // Update status to "Return Declined"
        itemToReturn.productStatus = 'Return Declined';
        await order.save();

        res.redirect('/admin/orders'); // Redirect to orders page after declining
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
            admin: req.session.admin, // Ensure admin data is passed correctly
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
            const coupon = await Coupon.find()
            console.log('couponId',couponId)
            const findCoupon = await Coupon.findByIdAndDelete(couponId)
            console.log('couponFinded',findCoupon)
            const afterDelete= await Coupon.find()
           return res.render('couponManagement',{
                message: { text: 'Coupon deleted successfully', type: 'success' },
                admin: req.session.admin, 
                active: 'coupons' ,
                coupon:afterDelete
            })
            
        } catch (error) {
            console.log('error while delete coupon',error)
        }
      }

      const LoadOfferManagement = async (req,res)=>{

        try {
            const product = await Product.find({ isActive: true });
            const offer = await Offer.find()
            
            console.log('products',product)
            console.log('offers',offer)
              res.render('offerManagement',{
                admin: req.session.admin,
                active: 'offers',
                message:null,
                offers:offer,
                products:product
               
            })
        } catch (error) {
            console.log('error while loading offer',error)
        }

      }


      const addOffer = async (req,res)=>{

        try {
            const offers = await Offer.find().populate('productId');
            const product = await Product.find({ isActive: true });
            
            const {offerType,discount,startDate,endDate,productId}=req.body;
            if(!offerType||!discount||!startDate||!endDate){
                return res.render('offerManagement',{
                    message: { text: 'Offer adding failed', type: 'error' },
                    admin: req.session.admin,
                    active: 'offers',
                    offers:offers,
                    products:product
                   
                })
            }
            const newOffer = new Offer({
                offerType:offerType,
                discount:discount,
                startDate:startDate,
                endDate:endDate,
                status:true,
                productId:productId
              
                

            })
            await newOffer.save()
            const offer= await Offer.find()
            console.log('new offer added',newOffer)
            return res.render('offerManagement',{
                message: { text: 'Offer added successfully', type: 'success' },
                admin: req.session.admin,
                active: 'offers',
                offers:offer,
                products: product // Ensure products array is passed
            });
            
            
        } catch (error) {
            console.log('error while adding offer',error)
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
    addOffer
}
