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
                        key_id: process.env.key_id,
                        wallet: wallet || { balance: 0 }, 
                        message: null
                    });
                    
                } catch (error) {
                    console.error('Error loading checkout:', error);
                    res.status(500).send('Internal Server Error');
                }
            };

            const placeOrder = async (req, res) => {
                try {
                    const { addressId, paymentMethod, couponCode } = req.body;
                    const userId = req.session.userId;
            
                    let wallet = await Wallet.findOne({ userId });

                    

                    if (!wallet) {
                        wallet = new Wallet({ userId, balance: 0 });
                        await wallet.save();
                    }
            
                    const cart = await Cart.findOne({ userId }).populate('item.productId');
                    if (!cart || !cart.item || cart.item.length === 0) {
                        return res.status(400).json({ success: false, message: 'Cart is empty or invalid.' });
                    }
            
                    const totalAmount = cart.cartTotal;
                    const discountAmount = cart.discountAmount;
            
                    const address = await Address.findById(addressId);
                    if (!address) {
                        return res.status(400).json({ success: false, message: 'Delivery address not found.' });
                    }
            
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
                        if (!product) {
                            return res.status(400).json({ success: false, message: 'Product not found.' });
                        }
            
                        const sizeIndex = product.stock.findIndex((s) => s.size === size);
                        if (sizeIndex === -1) {
                            return res.status(400).json({ success: false, message: `Size ${size} not found for the product.` });
                        }
            
                        const availableStock = product.stock[sizeIndex].quantity;
                        if (quantity > availableStock) {
                            return res.status(400).json({ success: false, message: `Insufficient stock for size ${size}. Only ${availableStock} items available.` });
                        }
            
                        product.stock[sizeIndex].quantity -= quantity;
                        product.totalStock -= quantity;
                        await product.save();
                    }
            
               
                    if (paymentMethod === 'Wallet') {
                        if (wallet.balance <= 0 || cart.discountedTotal > wallet.balance) {
                            return res.status(400).json({ success: false, message: 'Insufficient balance in wallet' });
                        }
                        wallet.balance -= cart.discountedTotal;  
                        await wallet.save();
                    } else if (paymentMethod === 'COD') {
                    
                    } else {
                        return res.status(400).json({ success: false, message: 'Invalid payment method.' });
                    }
                    
                   
                    const order = new Order({
                        userId,
                        cartId: cart._id,
                        orderedItem,
                        deliveryAddress: address,
                        orginalPrice:totalAmount,
                        orderAmount: totalAmount - discountAmount,
                        paymentMethod,
                        couponCode: couponCode || null,
                        couponDiscount: discountAmount,

                    });
            
                 
                    if (couponCode) {
                        await User.findByIdAndUpdate(userId, {
                            $addToSet: { usedCoupons: couponCode } 
                        });
                    }

                    await order.save();
                    await Cart.deleteOne({ userId });
            
                    res.json({ success: true, message: 'Order placed successfully.' });
                } catch (error) {
                    console.log('Error while placing order:', error);
                    res.status(500).json({ success: false, message: 'Internal Server Error' });
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
                 
                        itemToCancel.productStatus = 'cancelled';
                    }

                  
                    await Order.updateOne(
                        { _id: orderId, 'orderedItem.productId': productId },
                        { $set: { 'orderedItem.$.productStatus': 'cancelled' } }
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
                    const cart = await Cart.findOne({ userId: userId }).populate('item.productId');
            
                    if (!cart || !cart.item || cart.item.length === 0) {
                        return res.status(404).json({ error: 'Cart is empty or invalid' });
                    }
            
                   
                    for (let cartItem of cart.item) {
                        const product = await Product.findById(cartItem.productId);
                        
                        if (!product) {
                            return res.status(400).json({ 
                                success: false, 
                                message: 'Product not found or no longer available' 
                            });
                        }
                        
                        if (!product.isActive) {
                            return res.status(400).json({ 
                                success: false, 
                                message: `Product "${product.productName}" is no longer available` 
                            });
                        }
            
                       
                        const sizeIndex = product.stock.findIndex((s) => s.size === cartItem.size);
                        
                        if (sizeIndex === -1) {
                            return res.status(400).json({ 
                                success: false, 
                                message: `Size ${cartItem.size} is no longer available for "${product.productName}"` 
                            });
                        }
            
                        const availableStock = product.stock[sizeIndex].quantity;
                        
                        if (cartItem.quantity > availableStock) {
                            return res.status(400).json({ 
                                success: false, 
                                message: `Insufficient stock for "${product.productName}" in size ${cartItem.size}. Only ${availableStock} items available.` 
                            });
                        }
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
                        totalDiscount
                    });
            
                } catch (error) {
                    console.error('Razorpay order creation failed:', error);
                    res.status(500).json({ 
                        success: false, 
                        error: 'Payment initiation failed', 
                        message: error.message 
                    });
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
                    console.log('req.body', req.body);
            
                    let couponDiscount = 0; 
                    if (couponCode) {
                        const cpCode = couponCode.toUpperCase();
                        const couponUsed = await Coupon.findOne({ couponCode: cpCode });
                        console.log('couponUsed', couponUsed);
            
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
            
                    const cart = await Cart.findOne({ userId }).populate('item.productId');
                    
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
            
                    for (let item of orderedItem) {
                        const { productId, quantity, size } = item;
                        const product = await Product.findById(productId);
                        if (!product) {
                            return res.status(400).json({ success: false, message: 'Product not found.' });
                        }
            
                        const sizeIndex = product.stock.findIndex((s) => s.size === size);
                        if (sizeIndex === -1) {
                            return res.status(400).json({ success: false, message: `Size ${size} not found for the product.` });
                        }
            
                        const availableStock = product.stock[sizeIndex].quantity;
                        if (quantity > availableStock) {
                            return res.status(400).json({ success: false, message: `Insufficient stock for size ${size}. Only ${availableStock} items available.` });
                        }
                    } 
            
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
                            couponCode: couponName ? couponName.couponCode : "",
                            orginalPrice: cart.cartTotal,
                            couponDiscount: totalDiscount,
                            razorpayOrderId: razorpay_order_id
                        };
            
                        console.log('Creating order with data:', orderData);
                        const order = new Order(orderData);
                        await order.save();
            
                        
                        for (let item of orderedItem) {
                            const { productId, quantity, size } = item;
                            const product = await Product.findById(productId);
                            const sizeIndex = product.stock.findIndex((s) => s.size === size);
                            
                            
                            product.stock[sizeIndex].quantity -= quantity;
                            await product.save();
                        }
            
                       
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
                    console.log('Retry Payment Request Body:', req.body);
            
                    // Detailed logging
                    console.log('Environment Variables:', {
                        KEY_ID: process.env.KEY_ID ? 'Present' : 'Missing',
                        KEY_SECRET: process.env.KEY_SECRET ? 'Present' : 'Missing'
                    });
            
                    // Find the order
                    const order = await Order.findOne({ razorpayOrderId: razorpayOrderId });
                    if (!order) {
                        console.error('Order not found for ID:', razorpayOrderId);
                        return res.status(400).json({ 
                            success: false, 
                            error: 'Order not found',
                            details: { razorpayOrderId }
                        });
                    }
            
                    // Check payment status conditions
                    if (order.paymentStatus !== 'failed' && order.paymentStatus !== 'pending') {
                        console.error('Invalid payment status:', order.paymentStatus);
                        return res.status(400).json({ 
                            success: false, 
                            error: 'Only failed or pending payments can be retried',
                            details: { currentStatus: order.paymentStatus }
                        });
                    }
            
                    const Razorpay = require('razorpay');
                    
                    // Validate Razorpay credentials
                    if (!process.env.KEY_ID || !process.env.KEY_SECRET) {
                        console.error('Missing Razorpay credentials');
                        return res.status(500).json({ 
                            success: false, 
                            error: 'Missing Razorpay credentials' 
                        });
                    }
            
                    const razorpay = new Razorpay({
                        key_id: process.env.KEY_ID,
                        key_secret: process.env.KEY_SECRET
                    });
            
                    // Prepare order options
                    const options = {
                        amount: Math.round(order.orderAmount * 100), // Ensure integer
                        currency: 'INR',
                        receipt: 'retry_order_' + order._id
                    };
            
                    // Create new Razorpay order
                    let newOrder;
                    try {
                        newOrder = await razorpay.orders.create(options);
                    } catch (razorpayError) {
                        console.error('Razorpay Order Creation Error:', razorpayError);
                        return res.status(500).json({ 
                            success: false, 
                            error: 'Failed to create Razorpay order',
                            details: razorpayError.message
                        });
                    }
            
                    // Update order details
                    order.razorpayOrderId = newOrder.id;
                    order.paymentStatus = 'pending'; // Changed from 'paid' to 'pending'
                    
                    try {
                        await order.save();
                    } catch (saveError) {
                        console.error('Error saving order:', saveError);
                        return res.status(500).json({ 
                            success: false, 
                            error: 'Failed to update order',
                            details: saveError.message
                        });
                    }
            
                    res.json({
                        success: true,
                        razorpayOrderId: newOrder.id,
                        amount: order.orderAmount
                    });
            
                } catch (error) {
                    console.error('Comprehensive Error in retryPayment:', error);
                    res.status(500).json({ 
                        success: false, 
                        error: 'Failed to retry payment',
                        details: error.message 
                    });
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