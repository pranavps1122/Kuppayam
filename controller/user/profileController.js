const User =require('../../model/userSchema')
const Address=require('../../model/addressSchema')
const bcrypt=require('bcrypt')
const Order = require('../../model/orderSchema')
const {Product} =require('../../model/productSchema')
const Razorpay = require('razorpay');
require('dotenv').config();
const crypto = require('crypto');
const Wishlist = require('../../model/wishlistSchema')
const mongoose = require('mongoose');
const Cart=require('../../model/cartSchema')
const Wallet = require('../../model/walletSchema')
const Category=require('../../model/categorySchema')
const Offer=require('../../model/offerSchema')
const Coupon = require('../../model/couponSchema')

const razorpay = new Razorpay({
    key_id: process.env.key_id,
    key_secret: process.env.key_secret
});
const loadprofile = async (req,res) => {

    try {
       const user=await User.findOne({email:req.session.email })
       console.log('user',user)
       const address = await Address.find({userId:req.session.userId}); 
       console.log('address',address) 
      
        res.render('profile',{user,address})
       
    } catch (error) {
        console.log('skljfhjhf',error)
    }
}

const loadeditProfile = async (req,res)=>{
  
    try {
        const user=await User.findOne({email:req.session.email})

        const address = await Address.find({userId:req.session.userId}); 

        res.render('editprofile',{user,address})

    } catch (error) {
        
        console.log('error while loading profiledit page',error)
    }
}

const editprofile = async (req,res)=>{

    try {
        const {name,phone}=req.body
        const id=req.query.userId 
        console.log('editprofileid',id)
        const newUser={
            name,
            phone
        }
        await User.findByIdAndUpdate(id,newUser ,{
            new: true, 
          })
          res.redirect('profile')

    } catch (error) {
        console.log('error while updating profile',error)
    }
}

const loadresetpassword = async (req,res) => {
    
    const user=await User.findOne({email:req.session.email})

    try {
        res.render('resetpassword',{user,message:null})
    } catch (error) {
        console.log('error while reset password',error)
    }
}

const resetpassword = async (req,res)=>{
 try {
    const saltround=10
    const {currentpassword,confirmPassword,newPassword}=req.body
    const userId=req.session.userId 
    const user=await User.findOne({_id:userId})
    console.log('user:',user)

    const isMatch=await bcrypt.compare(newPassword,user.password)

    if(isMatch){
        res.render('resetpassword',{
            message:'Current password is wrong'
        })
  
    }else if(confirmPassword!==newPassword){
        res.render('resetpassword',{
            message:'Password are not matching'
        })
        
    }else{
        const passwordMatch= await bcrypt.compare(currentpassword,user.password)
        if(passwordMatch){
            const hashedPassword=await bcrypt.hash(newPassword,saltround)
         let updated=await User.updateOne({_id:userId},{$set:{password:hashedPassword}})
         console.log('update Sucessfully',updated)
        }
    }
    res.redirect('/profile')

    } catch (error) {

        console.log('error while changing password',error)
        
    }

}
const orderDetails = async (req, res) => {
    try {
        const userId = req.session.userId;
        const user = await User.findOne({ email: req.session.email });

        const page = parseInt(req.query.page) || 1; 
        const limit = parseInt(req.query.limit) || 5; 
        const skip = (page - 1) * limit;

        const totalOrders = await Order.countDocuments({ userId: userId });

        const orders = await Order.find({ userId: userId })
            .populate('orderedItem.productId')
            .skip(skip)
            .limit(limit);

        const totalPages = Math.ceil(totalOrders / limit);

        res.render('orderDetails', {
            orders,
            user,
            currentPage: page,
            totalPages,
        });
    } catch (error) {
        console.log('Error while running order page:', error);
        res.status(500).send('Server error');
    }
};


const loadorderStatus = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.session.userId;

        console.log('Attempting to find order with ID:', orderId);
        
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            console.log('Invalid order ID format:', orderId);
            return res.redirect('/orderDetails?error=Invalid order ID');
        }

        const order = await Order.findById(orderId);
        
        if (!order) {
            console.log('Order not found:', orderId);
            return res.redirect('/orderDetails?error=Order not found');
        }

        const populatedOrder = await Order.findById(orderId)
            .populate({
                path: 'orderedItem.productId',
                model: 'Product',
                select: 'productName productImage price'
            });

        console.log('Populated Order:', JSON.stringify(populatedOrder, null, 2));

        if (!populatedOrder) {
            console.log('Failed to populate order data');
            return res.redirect('/orderDetails?error=Failed to load order details');
        }

        res.render('orderStatus', {
            user: userId,
            order: populatedOrder,
            message: req.query.error || null
        });

    } catch (error) {
        console.error('Detailed error in loadorderStatus:', {
            error: error.message,
            stack: error.stack,
            orderId: req.params.id,
            userId: req.session.userId
        });
        
        
        console.log('Full error:', error);
        
        return res.render('orderStatus', {
            user: userId,
            order: null,
            message: 'Error loading order details'
        });
    }
};



const loadWishlist = async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'You need to be logged in to add items to your wishlist.' });
        }


        const wishlist = await Wishlist.findOne({ userId })
            .populate({
                path: 'items.productId',
                populate: {
                    path: 'category'
                }
            })
            .exec();

        if (!wishlist) {
            return res.render('wishlist', { 
                wishlistItems: [], 
                message: null 
            });
        }


        const processedWishlistItems = await Promise.all(
            wishlist.items.map(async (item) => {
                const product = item.productId;
                if (!product) return null;

              
             const productOffer = await Offer.findOne({ productId:product._id, status: { $eq: true } });
                    const categoryOffer = await Offer.findOne({ categoryId: product.category._id, status: { $eq: true } });

                const productDiscount = productOffer ? productOffer.discount : 0;
                const categoryDiscount = categoryOffer ? categoryOffer.discount : 0;

                const productDiscountAmount = (product.Price * productDiscount) / 100;
                const categoryDiscountAmount = (product.Price * categoryDiscount) / 100;

                const finalPrice = Math.round(
                    product.Price - Math.max(productDiscountAmount, categoryDiscountAmount)
                );

                const discountPercentage = Math.max(productDiscount, categoryDiscount);
                const discountType = productDiscount > categoryDiscount ? 'product' : 'category';

                return {
                    ...item.toObject(),
                    product: {
                        ...product.toObject(),
                        finalPrice,
                        discountPercentage,
                        discountType
                    }
                };
            })
        );

   
        const filteredWishlistItems = processedWishlistItems.filter(item => item !== null);

        res.render('wishlist', {
            wishlistItems: filteredWishlistItems,
            message: null
        });
    } catch (error) {
        console.error('Error while loading wishlist:', error);
        res.status(500).send('Internal Server Error');
    }
};


const wishlist = async (req, res) => {
    try {
        const { size } = req.body;
        const productId = req.params.id;
        const userId = req.session.userId;

        const product = await Product.findById(productId).populate('category');
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        const productOffer = await Offer.findOne({ productId, status: { $eq: true } });
        const categoryOffer = await Offer.findOne({ categoryId: product.category._id, status: { $eq: true } });

        const productDiscount = productOffer ? productOffer.discount : 0;
        const categoryDiscount = categoryOffer ? categoryOffer.discount : 0;
        const bestDiscount = Math.max(productDiscount, categoryDiscount);
        const discountAmount = Math.round((product.Price * bestDiscount) / 100);
        const finalPrice = product.Price - discountAmount;

   
        let wishlist = await Wishlist.findOne({ userId });
        if (!wishlist) {
            wishlist = new Wishlist({
                userId,
                items: []
            });
        }

     
        const existingItemIndex = wishlist.items.findIndex(item => 
            item.productId.equals(productId) && item.selectedSize === size
        );

        if (existingItemIndex !== -1) {
    
            const wishlistData = await Wishlist.findOne({ userId:userId })
                .populate({
                    path: 'items.productId',
                    populate: {
                        path: 'category'
                    }
                })
                .exec();

            const processedWishlistItems = await Promise.all(
                wishlistData.items.map(async (item) => {
                    const product = item.productId;
                    if (!product) return null;

                    const productOffer = await Offer.findOne({ productId, status: { $eq: true } });
                    const categoryOffer = await Offer.findOne({ categoryId: product.category._id, status: { $eq: true } });
                    

            
                    const productDiscount = productOffer ? productOffer.discount : 0;
                    const categoryDiscount = categoryOffer ? categoryOffer.discount : 0;
                    const productDiscountAmount = (product.Price * productDiscount) / 100;
                    const categoryDiscountAmount = (product.Price * categoryDiscount) / 100;
                    const finalPrice = Math.round(
                        product.Price - Math.max(productDiscountAmount, categoryDiscountAmount)
                    );

                    const discountPercentage = Math.max(productDiscount, categoryDiscount);
                    const discountType = productDiscount > categoryDiscount ? 'product' : 'category';

                    return {
                        ...item.toObject(),
                        product: {
                            ...product.toObject(),
                            finalPrice,
                            discountPercentage,
                            discountType
                        }
                    };
                })
            );
          
            const filteredWishlistItems = processedWishlistItems.filter(item => item !== null);



            return res.render('wishlist', {
                wishlistItems: filteredWishlistItems,
                message: 'Item already in wishlist'
            });
        }
        

        wishlist.items.push({
            productId,
            selectedSize: size,
            addedAt: new Date()
        });

        await wishlist.save();
        res.redirect('/wishlist');

    } catch (error) {
        console.error('Error adding to wishlist:', error);
        res.status(500).json({ message: 'Error adding to wishlist' });
    }
};

        const removeWishlist = async (req, res) => {
            try {
                const {product_id,productSize}=req.params;
                console.log(productSize,product_id)
             
                const userId = req.session.userId; 
                console.log('req.body',req.body)

            

            
                const result = await Wishlist.findOneAndUpdate(
                    { userId: new mongoose.Types.ObjectId(userId) },
                    { 
                      $pull: { 
                        items: { 
                          productId: new mongoose.Types.ObjectId(product_id), 
                          selectedSize: productSize  
                        } 
                      } 
                    },
                    { new: true } 
                  );
                  

                console.log('Product removed:', result);


                const afterUpdate = await Wishlist.findOne({ userId: new mongoose.Types.ObjectId(userId) });
                console.log('After update:', afterUpdate);

                res.redirect('/wishlist');
            } catch (error) {
                console.error('Error while removing product:', error);
                res.status(500).send('An error occurred while removing the product.');


            }
        };    
        const fromWishlist = async (req, res) => {
            try {
                const userId = req.session.userId;
                const productId = req.params.id;
        
                const findWishlist = await Wishlist.findOne(
                    {
                        userId: new mongoose.Types.ObjectId(userId),
                        items: {
                            $elemMatch: { productId: new mongoose.Types.ObjectId(productId) },
                        },
                    },
                    { "items.$": 1 }
                );
        
                if (!findWishlist || findWishlist.items.length === 0) {
                    req.session.alertMessage = { text: "Product not found in wishlist", icon: "error" };
                    return res.redirect("/wishlist");
                }
        
                const wishlistItem = findWishlist.items[0];
                const product = await Product.findById(wishlistItem.productId);
        
                if (!product || !product.Price || !product.stock) {
                    req.session.alertMessage = { text: "Invalid product data", icon: "error" };
                    return res.redirect("/wishlist");
                }
        
                const productOffer = await Offer.findOne({ productId, status: { $eq: true } });
                const categoryOffer = await Offer.findOne({ categoryId: product.category._id, status: { $eq: true } });
                
                const productDiscount = productOffer ? productOffer.discount : 0;
                const categoryDiscount = categoryOffer ? categoryOffer.discount : 0;
        
                const productDiscountAmount = (product.Price * productDiscount) / 100;
                const categoryDiscountAmount = (product.Price * categoryDiscount) / 100;
        
                const finalPrice = Math.round(
                    product.Price - Math.max(productDiscountAmount, categoryDiscountAmount)
                );
        
                const selectedSizeStock = product.stock.find(
                    (stock) => stock.size === wishlistItem.selectedSize
                );
                if (!selectedSizeStock) {
                    req.session.alertMessage = { text: "Selected size is not available", icon: "error" };
                    return res.redirect("/wishlist");
                }
        
                const total = finalPrice * 1;
                const cart = await Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) });
        
                if (!cart) {
                    const newCart = new Cart({
                        userId: new mongoose.Types.ObjectId(userId),
                        item: [
                            {
                                productId: product._id,
                                size: wishlistItem.selectedSize,
                                price: finalPrice,
                                stock: selectedSizeStock.quantity,
                                quantity: 1,
                                total: total,
                                addedAt: Date.now(),
                            },
                        ],
                        cartTotal: total,
                    });
        
                    await newCart.save();
                } else {
                    const existingItem = cart.item.find(
                        (item) => item.productId.toString() === productId && item.size === wishlistItem.selectedSize
                    );
        
                    if (existingItem) {
                        req.session.alertMessage = { text: "Product already in cart", icon: "warning" };
                        return res.redirect("/wishlist");
                    }
        
                    cart.item.push({
                        productId: product._id,
                        size: wishlistItem.selectedSize,
                        price: finalPrice,
                        stock: selectedSizeStock.quantity,
                        quantity: 1,
                        total: total,
                        addedAt: Date.now(),
                    });
        
                    cart.cartTotal = cart.item.reduce((total, item) => total + item.total, 0);
                    await cart.save();
                    await Wishlist.updateOne(
                        { userId: new mongoose.Types.ObjectId(userId) },
                        { $pull: { items: { productId: new mongoose.Types.ObjectId(productId) } } }
                    );
                }
        
                req.session.alertMessage = { text: "Product added to cart successfully!", icon: "success" };
                res.redirect("/cart");
            } catch (error) {
                console.error("Error while adding product to cart:", error);
                req.session.alertMessage = { text: "An error occurred while adding the product to cart", icon: "error" };
                res.redirect("/wishlist");
            }
        };
        
        const loadWallet = async (req, res) => {
            try {
                const userId = req.session.userId;
                if (!userId) {
                    return res.redirect('/login');
                }
        
             
                const user = await User.findById(userId);
                
                let wallet = await Wallet.findOne({ userId });
        
                const walletBalance = wallet ? wallet.balance : 0;

                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 5; 
                const skip = (page - 1) * limit;

             
                const transactions = wallet ? wallet.transactions.slice().reverse().slice(skip, skip + limit) : []; 

               
                const totalTransactions = wallet ? wallet.transactions.length : 0; 
                const totalPages = Math.ceil(totalTransactions / limit); 

                res.render('wallet', {
                    user,
                    walletBalance,
                    transactions,
                    currentPage: page,
                    totalPages,
                    message: null 
                });
            } catch (error) {
                console.error('Error while rendering wallet:', error);
                res.status(500).send('Internal server error');
            }
        };
        
        const createWallet = async (req, res) => {
            try {
                const userId = req.session.userId;
                if (!userId) {
                    return res.status(401).json({
                        success: false,
                        message: 'User not authenticated'
                    });
                }
        
               
                let wallet = await Wallet.findOne({ userId });
                if (wallet) {
                    return res.status(400).json({
                        success: false,
                        message: 'Wallet already exists'
                    });
                }
        
          
                wallet = new Wallet({
                    userId,
                    balance: 0,  
                    transactions: []  
                });
        
              
                await wallet.save();
        
                res.status(200).json({
                    success: true,
                    message: 'Wallet created successfully'
                });
            } catch (error) {
                console.error('Error creating wallet:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error'
                });
            }
        };
        


        const addMoney = async (req, res) => {
            try {
                const userId = req.session.userId;
                const { amount } = req.body;
        
                if (!amount || amount <= 0) {
                    return res.status(400).json({ message: 'Invalid amount' });
                }
                if (amount > 10000) {
                    return res.status(400).json({ message: '₹10,000 is the one-time limit' });
                }
        
                let wallet = await Wallet.findOne({ userId });
        
                if (!wallet) {
                    return res.status(400).json({ message: 'Wallet not found' });
                }
        
               
                const options = {
                    amount: amount * 100, 
                    currency: 'INR',
                    receipt: `wallet_${Date.now()}`,
                    payment_capture: 1,
                };
        
                const order = await razorpay.orders.create(options);
                res.json({ success: true, order });
        
            } catch (error) {
                console.error('Error while adding money:', error);
                res.status(500).json({ message: 'Internal server error' });
            }
        };






        const VerifyPayment = async (req, res) => {
            try {
              
        
                const { razorpay_payment_id, razorpay_order_id, razorpay_signature, amount } = req.body;
                console.log(req.body)
                const userId = req.session.userId;
        
                if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
                    console.log("Missing payment details");
                    return res.status(400).json({ message: 'Missing payment details' });
                }
        
                const generated_signature = crypto
                    .createHmac("sha256", process.env.key_secret)
                    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
                    .digest("hex");
        
                console.log("Generated Signature:", generated_signature);
                console.log("Received Signature:", razorpay_signature);
        
                if (generated_signature !== razorpay_signature) {
                    console.log("Signature mismatch - verification failed");
                    return res.status(400).json({ message: "Payment verification failed! Signature mismatch." });
                }
        
                let wallet = await Wallet.findOne({ userId });
                if (!wallet) {
                    console.log("Wallet not found for user:", userId);
                    return res.status(400).json({ message: "Wallet not found" });
                }
        
                wallet.balance += parseFloat(amount);
                await wallet.save();
        
                console.log(`Money added successfully! New balance: ₹${wallet.balance}`);
                return res.json({ message: "Money added successfully!", newBalance: wallet.balance });
        
            } catch (error) {
                console.error("Error verifying payment:", error);
                res.status(500).json({ message: "Payment verification failed due to server error." });
            }
        };
const addToWishlist = async (req, res) => {
    try {
        const userId = req.session.userId;
        const { productId, selectedSize } = req.body;

        const productExists = await Product.findById(productId);
        if (!productExists) {
            return res.status(404).json({ message: 'Product not found' });
        }

   
        let wishlist = await Wishlist.findOne({ userId });
        if (!wishlist) {
            wishlist = new Wishlist({ userId: userId, items: [] });
        }

       
        const productInWishlist = wishlist.items.find(item => 
            item.productId.toString() === productId && item.selectedSize === selectedSize
        );

        if (productInWishlist) {
            return res.status(400).json({ message: 'Product already in wishlist' });
        }

  
        wishlist.items.push({ productId: productId, selectedSize: selectedSize });
        await wishlist.save();

        res.status(200).json({ message: 'Product added to wishlist', wishlist });
    } catch (error) {
        console.error('Error adding to wishlist:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
const applyCoupon = async (req, res) => {
    try {
        const userId = req.session.userId;
        const { couponCode } = req.body;
        
        const cart = await Cart.findOne({ userId });
        const coupon = await Coupon.findOne({ couponCode: couponCode.toUpperCase() });

        if (!coupon) {
            return res.json({
                success: false,
                message: 'Invalid coupon code'
            });
        }

        if (coupon.status === false) {
            return res.json({
                success: false,
                message: 'Invalid coupon code'
            });
        }
       
        if (!cart) {
            return res.json({
                success: false,
                message: 'Cart not found'
            });
        }

      if(!coupon){
        return cart.cartTotal
      }

        let discountAmount = (cart.cartTotal * coupon.discount) / 100;
        
        cart.appliedCoupon = coupon._id;
        cart.discountAmount = discountAmount;
        cart.discountedTotal = cart.cartTotal - discountAmount;
  
        await cart.save();

        coupon.usedCount += 1;
        await coupon.save();

        res.json({
            success: true,
            discount: discountAmount,
            newTotal: cart.discountedTotal,
            message: 'Coupon applied successfully'
        });

    } catch (error) {
        console.error('Error applying coupon:', error);
        res.json({
            success: false,
            message: 'Error applying coupon'
        });
    }
};

    const removeCoupon = async (req, res) => {
        try {
            const userId = req.session.userId;
            const cart = await Cart.findOne({ userId });

            if (!cart) {
                return res.json({
                    success: false,
                    message: 'Cart not found'
                });
            }

            const originalPrice = cart.discountedTotal + cart.discountAmount;

            await Cart.findOneAndUpdate(
                { userId: userId },
                { 
                    cartTotal: originalPrice,
                    appliedCoupon: null,
                    discountAmount: 0
                }
            );

            req.session.appliedCoupon = null;

            res.json({
                success: true,
                newTotal: originalPrice,
                message: 'Coupon removed successfully'
            });

        } catch (error) {
            console.log('Error while removing the coupon', error);
        }
    };


    const availableCoupons = async (req, res) => {
        try {
            const userId = req.session.userId
            const cart = await Cart.findOne({userId})
            const coupons = await Coupon.find({status: true})
            
           
            const formattedCoupons = coupons.map(coupon => ({
                code: coupon.couponCode,
                description: coupon.description || `${coupon.discount}% off`,
                validUntil: coupon.expiryDate || new Date(Date.now() + 30*24*60*60*1000) 
            }))
            
      
            res.json({
                success: true,
                coupons: formattedCoupons
            })
        } catch (error) {
            console.log('error while loading available coupons', error)
            res.status(500).json({
                success: false,
                message: 'Failed to load available coupons'
            })
        }
    }













module.exports={
    loadprofile,
    loadeditProfile,
    editprofile,
    loadresetpassword,
    resetpassword,
    orderDetails,
    loadorderStatus,
    loadWishlist,
    wishlist,
    removeWishlist,
    fromWishlist,
    loadWallet,
    createWallet,
    addToWishlist,
    addMoney,
    applyCoupon,
    removeCoupon,
    VerifyPayment,
    availableCoupons
}