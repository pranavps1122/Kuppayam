            const Category = require('../../model/categorySchema');
            const { Product } = require('../../model/productSchema');
            const Cart=require('../../model/cartSchema')
            const Address = require('../../model/addressSchema')
            const Order =require('../../model/orderSchema');
            const { query } = require('express');
            const Razorpay = require('razorpay');
            const crypto = require('crypto');
            const Wallet = require('../../model/walletSchema');
            const User = require('../../model/userSchema');
            const Coupon = require('../../model/couponSchema');
            const Offer =require('../../model/offerSchema')
            const { cp } = require('fs/promises');

           
            const razorpay = new Razorpay({
                key_id: process.env.key_id,
                key_secret: process.env.key_secret
            });

            const fetchProducts = async (sortCriteria, categoryFilter, searchTerm, skip, limit) => {
                let query = {};
                
            
                const sortOptions = {
                    Az: { productName: 1 },
                    Za: { productName: -1 },
                    hightolow: { Price: -1 },
                    lowtohigh: { Price: 1 },
                };
            
                if (categoryFilter && categoryFilter !== 'all') {
                    const category = await Category.findOne({ categoryName: new RegExp(`^${categoryFilter}$`, 'i') });
                    if (!category) {
                        throw new Error(`Category "${categoryFilter}" not found`);
                    }
                    query.category = category._id;
                }
            
                if (searchTerm) {
                    query.$or = [
                        { productName: { $regex: searchTerm, $options: 'i' } },
                        { description: { $regex: searchTerm, $options: 'i' } },
                    ];
                }
            
                return Product.find(query)
                    .populate('category')
                    .sort(sortOptions[sortCriteria] || { productName: 1 })
                    .skip(skip)
                    .limit(limit);
            };
            
            const loadShop = async (req, res) => {
                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 8;
                const skip = (page - 1) * limit;
            
                try {
                    const searchTerm = req.query.search || '';
                    const categories = await Category.find();
                    const sortCriteria = req.query.sort || 'Az';
                    const categoryFilter = req.query.category || 'all';
            
                    const products = await fetchProducts(sortCriteria, categoryFilter, searchTerm, skip, limit);
            
                 
                    const productIds = products.map(product => product._id);
                    const categoryIds = products.map(product => product.category?._id).filter(id => id);
            
                  
                    const productOffers = await Offer.find({ productId: { $in: productIds }, status: true });
                    const categoryOffers = await Offer.find({ categoryId: { $in: categoryIds }, status: true });
            
                    const productsWithOffers = products.map(product => {
                        const productOffer = productOffers.find(o => 
                            o.productId.toString() === product._id.toString()
                        );
            
                        const categoryOffer = categoryOffers.find(o => 
                            o.categoryId.toString() === product.category?._id?.toString()
                        );
            
                        let productDiscount = productOffer ? Math.round(product.Price * productOffer.discount / 100) : 0;
                        let categoryDiscount = categoryOffer ? Math.round(product.Price * categoryOffer.discount / 100) : 0;
            
                        const bestDiscount = Math.max(productDiscount, categoryDiscount);
                        const bestDiscountPercentage = bestDiscount === productDiscount 
                            ? productOffer?.discount 
                            : categoryOffer?.discount;
            
                        return {
                            ...product.toObject(),
                            discountAmount: bestDiscount,
                            finalPrice: product.Price - bestDiscount,
                            discountPercentage: bestDiscountPercentage || 0,
                            discountType: bestDiscount === productDiscount ? 'product' : 'category',
                            originalPrice: product.Price
                        };
                    });
            
                    const query = {};
                    const filter = {};
            
                    if (categoryFilter && categoryFilter !== 'all') {
                        const category = await Category.findOne({ 
                            categoryName: new RegExp(`^${categoryFilter}$`, 'i') 
                        });
                        if (!category) {
                            throw new Error(`Category "${categoryFilter}" not found`);
                        }
                        filter.category = category._id;
                    }
            
                    if (searchTerm) {
                        query.$or = [
                            { productName: { $regex: searchTerm, $options: 'i' } },
                            { description: { $regex: searchTerm, $options: 'i' } },
                        ];
                    }
            
                    const totalProduct = await Product.countDocuments({
                        ...query,
                        ...filter,
                    });
            
                    const totalPages = Math.ceil(totalProduct / limit);
                    res.render('shop', {
                        categories,
                        products: productsWithOffers,
                        selectedSort: sortCriteria,
                        selectedCategory: categoryFilter,
                        search: searchTerm,
                        currentPage: page,
                        totalPages: totalPages,
                    });
            
                } catch (error) {
                    console.error('Error while rendering the shop page:', error);
                    res.status(500).send('Internal Server Error');
                }
            };
            
            
            const loadCheckout = async (req, res) => {
                try {
                    const userId = req.session.userId;
                    const user = req.session.user;
                    
                    const cart = await Cart.findOne({ userId: userId }).populate('item.productId');
                    const address = await Address.find({ userId: userId });
                    const wallet=await Wallet.findOne({userId:userId})

                    
                  

                    console.log('cart for checkout', cart);
                    console.log('address', address);

                    res.render('checkout', {
                        cart,
                        address,
                        user,
                        key_id: process.env.key_id ,
                        wallet,
                        message:null,
                    
                    });
                } catch (error) {
                    console.error('Error loading checkout:', error);
                    res.status(500).send('Internal Server Error');
                }
            };

            const placeOrder = async (req, res) => {
                try {
                    const { addressId, paymentMethod,couponCode,
                        appliedCoupon } = req.body;
                        console.log('dkhd',req.body)
                    const userId = req.session.userId;

                    
                    
                
                    const wallet=await Wallet.findOne({userId:userId})
                    
                    const cart = await Cart.findOne({ userId: userId }).populate('item.productId');

                    const totalAmount = cart.cartTotal;
                    const discountAmount = cart.discountAmount;
                    const coupon=cart.appliedCoupon
                    const couponUsed= await Coupon.findOne({_id:coupon})
          
                 

                
                    const address = await Address.findById(addressId);
                

                    const orderedItem = cart.item.map((item) => ({
                        productId: item.productId._id,
                        quantity: item.quantity,
                        size: item.size,
                        productPrice: item.price,
                        totalProductPrice: item.price * item.quantity,
                    }));

                

                    
                    for (let item of orderedItem) {
                        const { productId, quantity, size } = item;
                        const product = await Product.findById(productId);

                        if (product) {
                        
                            const sizeIndex = product.stock.findIndex((s) => s.size === size);

                            if (sizeIndex !== -1) {
                                const availableStock = product.stock[sizeIndex].quantity;

                        
                                if (quantity > availableStock) {
                                
                                    return res.render('cart',{
                                        message:`Insufficient stock for size ${size}. Only ${availableStock} items available.`,
                                        cart
                                    })
                                
                                }

                            
                            
                                product.stock[sizeIndex].quantity -= quantity;
                                product.totalStock -= quantity;
                                await product.save();
                            } else {
                                console.log('product with particular size not found');
                                return res.status(400).send(`Size ${size} not found for the product.`);
                            }
                        } else {
                            console.log('product not found');
                            return res.status(400).send('Product not found.');
                        }
                    }
                     
                    if(paymentMethod=='Wallet'){
                        if(wallet.balance<=0){
                            return res.status(400).send('Insufficient wallet balance.');
                        }
                        if(cart.cartTotal>wallet.balance){
                            return res.status(400).send('Insufficient wallet balance.');
                        }
                        wallet.balance-=cart.cartTotal
                    }
                
                    await wallet.save()

                    const order = new Order({
                        userId: userId,
                        cartId: cart._id,
                        orderedItem: orderedItem,
                        deliveryAddress: address,
                        orginalPrice: cart.cartTotal,
                        orderAmount: cart.cartTotal - cart.discountAmount,
                        paymentMethod: paymentMethod,
                        couponCode: couponUsed ? couponUsed.couponCode : null, 
                        couponDiscount: discountAmount
                    });
                    
                    console.log('order placed successfully',order)
                    await order.save();
                    cart.cartTotal=null
                    await cart.deleteOne({ userId: userId });
                   


                
                    res.redirect('/ordersuccess');

                } catch (error) {
                    console.log('error while placing order', error);
                    res.status(500).send('Internal Server Error');
                }
            };

            const orderSuccess = async (req,res)=>{
                try {
           
                    const order = await Order.find()
              
                   
                    res.render('orderSuccess',{
                        order,
                        
                    })
                } catch (error) {
                    
                }
            }

            const cancelOrder = async (req, res) => {
                try {
                    const userId = req.session.userId;
                    const orderId = req.params.orderid;
                    const productId = req.params.productid;


                    const order = await Order.findOne({ userId: userId, _id: orderId }).populate('orderedItem.productId');
                    
                    const totalQuantity = order.orderedItem.reduce((sum, item) => sum + item.quantity, 0);
                    console.log('total quantity',totalQuantity)
                    
                    
                    if (!order) {
                        return res.status(404).render('orderStatus', {
                            message: 'Order not found',
                            order: null
                        });
                    }

                    const itemToCancel = order.orderedItem.find(item => item.productId._id.toString() === productId);
                    
                    if (!itemToCancel) {
                        return res.status(404).render('orderStatus', {
                            message: 'Product not found in this order',
                            order: null
                        });
                    }
 
                 
                    console.log('order discount',order.couponDiscount>0)
                    let refundAmount;

                    if (order.couponDiscount > 0) {
                        refundAmount = order.orderAmount / totalQuantity; 
                    } else {
                        refundAmount = itemToCancel.totalProductPrice; 
                    }
                    

                    const product = await Product.findById(itemToCancel.productId._id);
                    if (product) {
                        const sizeIndex = product.stock.findIndex(stock => stock.size === itemToCancel.size);
                        if (sizeIndex !== -1) {
                            product.stock[sizeIndex].quantity += itemToCancel.quantity; 
                            product.totalStock += itemToCancel.quantity; 
                            await product.save();
                        }
                 
                        itemToCancel.productStatus = 'Cancelled';
                    }

                  
                    await Order.updateOne(
                        { _id: orderId, 'orderedItem.productId': productId },
                        { $set: { 'orderedItem.$.productStatus': 'Cancelled' } }
                    );

          
                    let wallet = await Wallet.findOne({ userId: userId });
                    if (!wallet) {
                        wallet = new Wallet({
                            userId: userId,
                            balance: 0,
                            transactions: [] 
                        });
                        await wallet.save();
                    }

                   
                    if (!wallet.transactions) {
                        wallet.transactions = []; 
                    }

                 
                    wallet.transactions.forEach(transaction => {
                        if (!transaction.transactionsMethod) {
                            console.warn('Found transaction without transactionsMethod:', transaction);
                        }
                    });

                    console.log('jdfbhbjdh',itemToCancel.quantity)
                    wallet.balance += refundAmount


               
                    const newTransaction = {
                        amount: refundAmount,
                        transactionsMethod: 'Refund', 
                        date: new Date(),
                        orderId: orderId 
                    };

                  
                

                    wallet.transactions.push(newTransaction);
                    await wallet.save(); 

                

                    res.render('orderStatus', {
                        message: `Product cancelled successfully. ₹${refundAmount} added to your wallet.`,
                        order: order
                    });

                } catch (error) {
                    console.error('Error during order cancellation:', error);
                    res.status(500).render('orderStatus', {
                        message: 'Error processing cancellation',
                        order: null
                    });
                }
            };




            const returnOrder = async (req, res) => {
                try {
                    const userId = req.session.userId;
                    const orderId = req.params.orderid;
                    const productId = req.params.productid;
                    const returnReason = req.body.reason;

                    console.log('req.body',req.body)

                    const order = await Order.findOne({ userId: userId, _id: orderId }).populate('orderedItem.productId');
                 
        
                    if (!order) {
                        return res.status(404).render('orderStatus', { message: 'Order not found', order: null });
                    }
            
                    const itemToReturn = order.orderedItem.find(item => item.productId._id.toString() === productId);
            
                    if (!itemToReturn) {
                        return res.status(404).render('orderStatus', { message: 'Product not found in order', order: null });
                    }
            
            
                    itemToReturn.productStatus = 'Return Requested';
                    order.returnReason= returnReason;


                    

                    await order.save();
            
                    res.render('orderStatus', {
                        message: 'Return request submitted. Awaiting admin approval.',
                        order: order
                    });
            
                } catch (error) {
                    console.error('Error during return request:', error);
                    res.status(500).render('orderStatus', {
                        message: 'Error processing return request',
                        order: null
                    });
                }
            };
            



          
            const initiateRazorpay = async (req, res) => {
                try {
                    const userId = req.session.userId;
                    const cart = await Cart.findOne({ userId: userId });
            
                    if (!cart) {
                        return res.status(404).json({ error: 'Cart not found' });
                    }
            
                    let totalDiscount = 0;
            
                    if (cart.appliedCoupon) {
                        const couponUsed = await Coupon.findOne({ _id: cart.appliedCoupon });
            
                        if (couponUsed) {
                            totalDiscount = (cart.cartTotal * couponUsed.discount) / 100;
                        }
                    }
            
                    const discountedTotal = cart.cartTotal - totalDiscount;
            
                    const options = {
                        amount: Math.round(discountedTotal * 100), 
                        currency: 'INR',
                        receipt: 'order_' + Date.now(),
                    };
            
                    const order = await razorpay.orders.create(options);
            
                    res.json({
                        success: true,
                        order: {
                            id: order.id,
                            amount: discountedTotal, 
                        },
                    });
            
                } catch (error) {
                    console.error('Razorpay order creation failed:', error);
                    res.status(500).json({ error: 'Payment initiation failed' });
                }
            };
            
            const verifyPayment = async (req, res) => {
                try {
                    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, couponCode, addressId } = req.body;

            
                    console.log('Starting payment verification with details:', {
                        razorpay_order_id,
                        couponCode,
                        payment_id: razorpay_payment_id
                    });
                    console.log('req.body',req.body)
            
                    let couponDiscount = 0; 
                    if (couponCode) {
                        const cpCode = couponCode.toUpperCase();
                        const couponUsed = await Coupon.findOne({ couponCode: cpCode });
                        console.log('couponUsed',couponUsed);
            
                        if (couponUsed) {
                            couponDiscount = (couponUsed.discount / 100); 
                            console.log('Found coupon details:', couponUsed);
                        }
                    }
            

                    const generated_signature = crypto
                        .createHmac('sha256', process.env.key_secret)
                        .update(razorpay_order_id + '|' + razorpay_payment_id)
                        .digest('hex');
            
                    const userId = req.session.userId;
                    if (!userId) {
                        console.error('Error: Missing userId in session');
                        return res.status(400).json({ error: 'User not authenticated' });
                    }
            
                    const cart = await Cart.findOne({ userId });
                    if (!cart || !cart.item || cart.item.length === 0) {
                        return res.status(400).json({ error: 'Cart is empty or invalid' });
                    }
            
                    const address = await Address.findById(addressId);
                    if (!address) {
                        return res.status(400).json({ error: 'Delivery address not found' });
                    }
            
                    const orderedItem = cart.item.map(item => ({
                        productId: item.productId,
                        quantity: Number(item.quantity),
                        size: item.size,
                        productPrice: Number(item.price),
                        productStatus: 'pending',
                        totalProductPrice: Number(item.price) * Number(item.quantity)
                    }));
            
                    const coupon = cart.appliedCoupon;
                    
                 
                    let totalDiscount = 0; 
            
                    if (coupon) {
                        const couponUsed = await Coupon.findOne({ _id: coupon });
            
                        if (couponUsed) {
                            totalDiscount = (cart.cartTotal * couponUsed.discount) / 100;
                            console.log('totalDiscount', totalDiscount);
                        }
                    }

                    const couponName = coupon ? await Coupon.findOne({ _id: coupon }) : null;

            
                    if (generated_signature === razorpay_signature) {
                        console.log('Payment verified successfully');
            
                        const orderData = {
                            userId,
                            cartId: cart._id,
                            orderedItem,
                            deliveryAddress: address,
                            orderAmount: Number(cart.cartTotal) - totalDiscount,
                            paymentMethod: 'Online Payment',
                            paymentStatus: 'paid',
                            paymentId: razorpay_payment_id,
                            couponCode: couponName.couponCode || "",
                            orginalPrice:cart.cartTotal,
                            couponDiscount: totalDiscount,
                            razorpayOrderId: razorpay_order_id
                        };
            
                        console.log('Creating order with data:', orderData);
                        const order = new Order(orderData);
                        await order.save();
            
                        // Clear applied coupon & cart
                        cart.appliedCoupon = null;
                        await Cart.findOneAndDelete({ userId });
            
                        return res.json({
                            success: true,
                            orderId: order._id,
                            totalDiscount,
                            message: 'Order placed successfully'
                        });
                    } else {
                        console.log('Payment verification failed!');
            
                        return res.status(400).json({
                            success: false,
                            error: 'Payment verification failed. Signature mismatch.',
                            redirectUrl: '/payment-failed'
                        });
                    }
                } catch (error) {
                    console.log('Detailed error:', {
                        message: error.message,
                        stack: error.stack,
                        name: error.name
                    });
            
                    res.status(500).json({
                        success: false,
                        error: 'Internal server error',
                        message: error.message
                    });
                }
            };
            

            const paymentFailed = async (req,res)=>{
                console.log('entering inton payment failed ')
                try {
                    const { razorpay_order_id, razorpay_payment_id, error_code, error_description, addressId } = req.body;
            
                    const userId = req.session.userId;
                    if (!userId) {
                        return res.status(400).json({ error: 'User not authenticated' });
                    }
            
                    const cart = await Cart.findOne({ userId });
                    if (!cart || !cart.item || cart.item.length === 0) {
                        return res.status(400).json({ error: 'Cart is empty or invalid' });
                    }
            
                    const address = await Address.findById(addressId);
                    if (!address) {
                        return res.status(400).json({ error: 'Delivery address not found' });
                    }
            
                    const orderedItem = cart.item.map(item => {
                        const itemTotal = Number(item.price) * Number(item.quantity);
                        return {
                            productId: item.productId,
                            quantity: Number(item.quantity),
                            size: item.size,
                            productPrice: Number(item.price),
                            productStatus: 'pending',
                            totalProductPrice: itemTotal
                        };
                    });
            
               
                    const failedOrder = new Order({
                        userId,
                        cartId: cart._id,
                        orderedItem,
                        deliveryAddress: [address], 
                        orderAmount: Number(cart.cartTotal),
                        paymentMethod: 'Online Payment',
                        paymentStatus: 'pending',
                        razorpayOrderId: razorpay_order_id,
                        paymentId: razorpay_payment_id
                    });
            
                    await failedOrder.save();
                    await Cart.findOneAndDelete({ userId });
            
                    return res.json({
                        success: true,
                        message: 'Failed order saved successfully'
                    });
                } catch (error) {
                    console.error('Error saving failed order:', error);
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to save payment failure details'
                    });
                }
            }
            
            const retryPayment = async (req, res) => {
                try {
                    const { razorpayOrderId } = req.body;
                    console.log('Retry Payment Request:', req.body);
            
                  
                    const order = await Order.findOne({ razorpayOrderId: razorpayOrderId });
                    if (!order) {
                        return res.status(400).json({ success: false, error: 'Order not found' });
                    }
            
                  
                    if (order.paymentStatus !== 'failed' && order.paymentStatus !== 'pending') {
                        return res.status(400).json({ success: false, error: 'Only failed payments can be retried' });
                    }
            
                    const Razorpay = require('razorpay');
                    
                    const razorpay = new Razorpay({
                        key_id: process.env.KEY_ID,
                        key_secret: process.env.KEY_SECRET
                    });
            
                    
                    const options = {
                        amount: order.orderAmount * 100, 
                        currency: 'INR',
                        receipt: 'retry_order_' + order._id
                    };
            
                    const newOrder = await razorpay.orders.create(options);
            
                    
                    order.razorpayOrderId = newOrder.id;
                    order.paymentStatus = 'paid';
                    await order.save();
            
                    res.json({
                        success: true,
                        razorpayOrderId: newOrder.id,
                        amount: order.orderAmount
                    });
            
                } catch (error) {
                    console.error('Error in retryPayment:', error);
                    res.status(500).json({ success: false, error: 'Failed to retry payment' });
                }
            };
            
            const loadWallet = async (req, res) => {
                try {
                    const userId = req.session.userId;

                    const user = await User.findById(userId);
                    
                    let wallet = await Wallet.findOne({ userId }).populate('transactions.orderId'); 
                    
                
                    const walletBalance = wallet ? wallet.balance : 0;
                    const transactions = wallet ? wallet.transactions : [];

                    console.log('Wallet:', wallet);
                    console.log('Transactions:', transactions);

                    res.render('wallet', {
                        user,
                        walletBalance,
                        transactions,
                        message: null 
                    });
                } catch (error) {
                    console.error('Error while rendering wallet:', error);
                    res.status(500).send('Internal server error');
                }
            };



            module.exports = {
                loadShop,
                loadCheckout,
                placeOrder,
                orderSuccess,
                cancelOrder,
                initiateRazorpay,
                verifyPayment,
                loadWallet,
                returnOrder,
                retryPayment,
                paymentFailed
               
            };