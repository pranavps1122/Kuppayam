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

            // Initialize Razorpay
            const razorpay = new Razorpay({
                key_id: process.env.key_id,
                key_secret: process.env.key_secret
            });

            const fetchProducts = async (sortCriteria, categoryFilter,searchTerm,skip,limit) => {
                let query = {};
                const sortOptions = {
                    Az: { productName: 1 },
                    Za: { productName: -1 },
                    hightolow: { Price: -1 },
                    lowtohigh: { Price: 1 },
                };

                const filter = {};
                if (categoryFilter && categoryFilter !== 'all') {
            
                    const category = await Category.findOne({ categoryName: new RegExp(`^${categoryFilter}$`, 'i') });
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

                return Product.find(query).where(filter).sort(sortOptions[sortCriteria] || { productName: 1 }).skip(skip).limit(limit);
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
                    const categoryIds = categories.map(category => category._id);
                    
                    const productOffers = await Offer.find({ productId: { $in: productIds } });
                    const categoryOffers = await Offer.find({ categoryId: { $in: categoryIds } });
            
                    const productsWithOffers = products.map(product => {
                       
                        const productOffer = productOffers.find(o => 
                            o.productId.toString() === product._id.toString()
                        );
                      
                        const categoryOffer = categoryOffers.find(o => 
                            o.categoryId.toString() === product.category.toString()
                        );
            
                    
                        let productDiscount = 0;
                        let categoryDiscount = 0;
                        
                        if (productOffer) {
                            productDiscount = Math.round(product.Price * productOffer.discount / 100);
                        }
                        
                        if (categoryOffer) {
                            categoryDiscount = Math.round(product.Price * categoryOffer.discount / 100);
                        }
            
             
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
                        searchQuery: searchTerm,
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

                    console.log('cart for checkout', cart);
                    console.log('address', address);

                    res.render('checkout', {
                        cart,
                        address,
                        user, // Pass user object to the template
                        key_id: process.env.key_id ,// Pass Razorpay key_id,
                        message:null
                    });
                } catch (error) {
                    console.error('Error loading checkout:', error);
                    res.status(500).send('Internal Server Error');
                }
            };

            const placeOrder = async (req, res) => {
                try {
                    const { addressId, paymentMethod } = req.body;
                    const userId = req.session.userId;
                    
                
                    const cart = await Cart.findOne({ userId: userId }).populate('item.productId');
                    const totalAmount = cart.cartTotal;
                    console.log('cartTotal', totalAmount);
                    console.log('user cart fetched', cart);

                
                    const address = await Address.findById(addressId);
                    console.log('address fetched in stage of placeorder', address);

                    const orderedItem = cart.item.map((item) => ({
                        productId: item.productId._id,
                        quantity: item.quantity,
                        size: item.size,
                        productPrice: item.price,
                        totalProductPrice: item.price * item.quantity,
                    }));

                    console.log('ordered item', orderedItem);

                    
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

                    const order = new Order({
                        userId: userId,
                        cartId: cart._id,
                        orderedItem: orderedItem,
                        deliveryAddress: address,
                        orderAmount: cart.cartTotal,
                        paymentMethod: paymentMethod
                    });

                    await order.save();
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
                        order
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

   
                    const refundAmount = itemToCancel.productPrice * itemToCancel.quantity;

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

                    wallet.balance += refundAmount;

               
                    const newTransaction = {
                        amount: refundAmount,
                        transactionsMethod: 'Refund', 
                        date: new Date(),
                        orderId: orderId 
                    };

                  
                    console.log('New Transaction:', newTransaction);

                    wallet.transactions.push(newTransaction);
                    await wallet.save(); 

                    console.log('Existing Transactions:', wallet.transactions);

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
                    const order = await Order.findOne({ userId: userId, _id: orderId }).populate('orderedItem.productId');
            
                    if (!order) {
                        return res.status(404).render('orderStatus', { message: 'Order not found', order: null });
                    }
            
                    const itemToReturn = order.orderedItem.find(item => item.productId._id.toString() === productId);
            
                    if (!itemToReturn) {
                        return res.status(404).render('orderStatus', { message: 'Product not found in order', order: null });
                    }
            
                    // Update status to "Return Requested"
                    itemToReturn.productStatus = 'Return Requested';
            
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
            



            // Update the initiateRazorpay function
            const initiateRazorpay = async (req, res) => {
                try {
                    const userId = req.session.userId;
                    const cart = await Cart.findOne({ userId: userId });
                    
                    if (!cart) {
                        return res.status(404).json({ error: 'Cart not found' });
                    }

                    const options = {
                        amount: cart.cartTotal * 100,
                        currency: 'INR',
                        receipt: 'order_' + Date.now(),
                    };

                    // Create Razorpay order
                    const order = await razorpay.orders.create(options);

                    res.json({ 
                        success: true, 
                        order: {
                            id: order.id,
                            amount: cart.cartTotal
                        }
                    });

                } catch (error) {
                    console.error('Razorpay order creation failed:', error);
                    res.status(500).json({ error: 'Payment initiation failed' });
                }
            };

            // Add this function to verify payment
            const verifyPayment = async (req, res) => {
                try {
                    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
                    
                    // Verify the payment signature
                    const generated_signature = crypto
                        .createHmac('sha256', process.env.key_secret)
                        .update(razorpay_order_id + '|' + razorpay_payment_id)
                        .digest('hex');

                    if (generated_signature === razorpay_signature) {
                        // Payment successful, process the order
                        const userId = req.session.userId;
                        const cart = await Cart.findOne({ userId: userId });
                        const address = await Address.findById(req.body.addressId);

                        // Create order similar to COD flow
                        const order = new Order({
                            userId: userId,
                            cartId: cart._id,
                            orderedItem: cart.item.map(item => ({
                                productId: item.productId,
                                quantity: item.quantity,
                                size: item.size,
                                productPrice: item.price,
                                totalProductPrice: item.price * item.quantity,
                            })),
                            deliveryAddress: address,
                            orderAmount: cart.cartTotal,
                            paymentMethod: 'Online Payment',
                            paymentId: razorpay_payment_id
                        });

                        await order.save();
                        await cart.deleteOne({ userId: userId });

                        res.json({ success: true });
                    } else {
                        res.status(400).json({ error: 'Payment verification failed' });
                    }
                } catch (error) {
                    console.error('Payment verification failed:', error);
                    res.status(500).json({ error: 'Internal server error' });
                }
            };

            const loadWallet = async (req, res) => {
                try {
                    const userId = req.session.userId;

                    // Find the user
                    const user = await User.findById(userId);
                    
                    // Find the user's wallet (if exists)
                    let wallet = await Wallet.findOne({ userId }).populate('transactions.orderId'); // Ensure this is correct
                    
                    // If no wallet exists, initialize with default values
                    const walletBalance = wallet ? wallet.balance : 0;
                    const transactions = wallet ? wallet.transactions : [];

                    // Log the wallet and transactions for debugging
                    console.log('Wallet:', wallet);
                    console.log('Transactions:', transactions);

                    res.render('wallet', {
                        user,
                        walletBalance,
                        transactions,
                        message: null // Optional: You can pass any message here, such as success or error messages
                    });
                } catch (error) {
                    console.error('Error while rendering wallet:', error);
                    res.status(500).send('Internal server error');
                }
            };



            const applyCoupon = async (req, res) => {
                try {
                    const userId=req.session.userId
                    const cart = await Cart.findOne({ userId: userId }).populate('item.productId');
                    const address = await Address.find({ userId: userId });
                    const user=req.session.userId

                    const { couponCode } = req.body;
                    console.log(couponCode);
                    console.log(typeof couponCode);
            
                    
                    const coupons = await Coupon.find();
                    console.log(typeof coupons);
            
                  
                    let cpCode = coupons.filter((el) => el.couponCode === couponCode.toUpperCase()); 
                    console.log('cpCode', cpCode);
            

                 
                    if (cpCode.length==0) {
                     
                        return res.render('checkout', {
                            message: 'Enter a valid coupon',
                            messageType:'error',
                            cart:cart,
                            address,
                            user
                        });
                    }
                    
                 
                    if ( req.session.couponCode===couponCode) {
                     
                        return res.render('checkout', {
                            message: 'Coupon already applied',
                            messageType:'error',
                            cart:cart,
                            address,
                            user
                        });
                    }


                    console.log(cpCode[0].discount);
                    const discountAmount=Math.round(cart.cartTotal*cpCode[0].discount/100)
                    const update =Math.round(cart.cartTotal-(cart.cartTotal*cpCode[0].discount/100))
                    
                    cart.cartTotal=update
                    console.log('discount amount of this',discountAmount)
                    console.log('update',update)
                    console.log('cartTotal',cart.cartTotal)

                    req.session.couponCode = couponCode;
                    req.session.discountAmount=discountAmount
                    
                   
                    await cart.save()

                    res.render('checkout',{
                        message: 'Coupon applied successfully!',
                        messageType:'success',
                        cart: cart,
                        address: address,
                        user: user
                    })
              
                   
               
                 console.log('coupon code is saved',req.session.couponCode)
                 console.log(req.session.cartTotal)
            
                } catch (error) {
                    console.log('Error while applying coupon', error);
                }
            };
            


            const removeCoupon = async (req, res) => {
                try {
                 
                   console.log('this is the discount amount ', req.session.discountAmount)
                   couponCode = req.session.couponCode;
                   const userId=req.session.userId
                   const cart = await Cart.findOne({ userId: userId }).populate('item.productId');
                   const address = await Address.find({ userId: userId });
                   let cpCode = await Coupon.find({couponCode:couponCode})
                   console.log('sdhsdfjhfjhsffbhsgfuyf',cpCode)
                 
                   cart.cartTotal+= req.session.discountAmount
                   req.session.couponCode = null;
                   await cart.save()
                   


                   console.log('updatedCheckout',cart.cartTotal)
                    res.redirect('/checkout');
                  
                } catch (error) {
                    console.log('Error while removing the coupon:', error);
                    res.status(500).send('Internal Server Error');
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
                applyCoupon,
                removeCoupon
            };