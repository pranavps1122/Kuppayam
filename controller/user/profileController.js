const User =require('../../model/userSchema')
const Address=require('../../model/addressSchema')
const bcrypt=require('bcrypt')
const Order = require('../../model/orderSchema')
const { Product } = require('../../model/productSchema')
const Wishlist = require('../../model/wishlist')
const mongoose = require('mongoose');
const Cart=require('../../model/cartSchema')


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
        res.render('resetpassword',{user})
    } catch (error) {
        
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
       res.redirect('/resetpassword')
  
    }else if(confirmPassword!==newPassword){
        res.redirect('/resetpassword')
        
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
        const user = await User.findOne({ email: req.session.email });

        const page = parseInt(req.query.page) || 1; 
        const limit = parseInt(req.query.limit) || 5; 
        const skip = (page - 1) * limit;

        const totalOrders = await Order.countDocuments();


        const orders = await Order.find()
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
      const productId = req.params.id;
      const userId = req.session.userId;
  
      const order = await Order.findById(productId)
        .populate('orderedItem.productId');
  
      res.render('orderStatus', {
        user: userId,
        order,
        message:null
      });
    } catch (error) {
      console.error('Error rendering orderStatus page:', error);
      res.status(500).send('Internal Server Error');
    }
  };

  
  const loadWishlist = async (req, res) => {
    const userId = req.session.userId; 

    try {
 
        const user = await User.findById(userId); 
        console.log('User:', user);

      
        const wishlistItems = await Wishlist.findOne({ userId: userId }).populate('items.productId');
        console.log('Wishlist Items:', wishlistItems);

     
        res.render('wishlist', {
            user: user,
            wishlistItems: wishlistItems ? wishlistItems.items : [] ,
            message:null
        });
    } catch (error) {
        console.error('Error loading wishlist:', error);
        res.status(500).send('An error occurred while loading your wishlist.');
    }
};

  const wishlist = async (req, res) => {
      const { size } = req.body; 
      const productId = req.params.id;  
      const userId = req.session.userId; 
  
      try {

          const product = await Product.findById(productId);
  
          if (!product) {
              return res.status(404).send('Product not found');
          }
  
         
          let wishlist = await Wishlist.findOne({ userId });
  
          if (!wishlist) {
              wishlist = new Wishlist({ userId, items: [] });
          }
  

          const existingItem = wishlist.items.find(item => item.productId.toString() === productId);
  
          if (existingItem) {
              return res.status(400).send('Product is already in the wishlist');
          }
  
          wishlist.items.push({
              productId: product._id,
              addedAt: new Date(),
              selectedSize: size 
          });
  
     
          await wishlist.save();
  
          
          res.redirect('/wishlist');
      } catch (error) {
          console.error('Error adding product to wishlist:', error);
          res.status(500).send('Server error');
      }
  };



        const removeWishlist = async (req, res) => {
            try {
                const productId = req.params.id; 
                const userId = req.session.userId; 

                console.log('productId:', productId);
                console.log('typeof userId:', typeof userId);
                console.log('typeof productId:', typeof productId);

            
                const result = await Wishlist.findOneAndUpdate(
                    { userId: new mongoose.Types.ObjectId(userId) },
                    { $pull: { items: { productId: new mongoose.Types.ObjectId(productId) } } },
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
                console.log('Product ID:', productId);
                console.log('Request body:', req.body);
        
                const findWishlist = await Wishlist.findOne(
                    {
                        userId: new mongoose.Types.ObjectId(userId),
                        items: { 
                            $elemMatch: { productId: new mongoose.Types.ObjectId(productId) }
                        }
                    },
                    {
                        "items.$": 1
                    }
                );
        
                if (!findWishlist || findWishlist.items.length === 0) {
                    console.log('Product not found in wishlist');
                    return res.status(404).json({ message: 'Product not found in wishlist' });
                }
        
                const wishlistItem = findWishlist.items[0];
                console.log('Found product in wishlist:', wishlistItem);
        
                const product = await Product.findById(wishlistItem.productId);
                console.log('Found product details:', product);
        
                if (!product || !product.Price || !product.stock) {
                    console.log('Invalid product data detected');
                    return res.status(400).json({ message: 'Invalid product data' });
                }
        
                const selectedSizeStock = product.stock.find(stock => stock.size === wishlistItem.selectedSize);
                if (!selectedSizeStock) {
                    console.log('Selected size is not available');
                    return res.status(400).json({ message: 'Selected size is not available' });
                }
        
                console.log('Product price:', product.Price);
                console.log('Selected size stock:', selectedSizeStock.quantity);
                console.log('Selected size:', wishlistItem.selectedSize);
        
                const total = product.Price * 1;
        
                const cart = await Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) });
                console.log('Cart found:', cart);
        
                if (!cart) {
                    const newCart = new Cart({
                        userId: new mongoose.Types.ObjectId(userId),
                        item: [{
                            productId: product._id,
                            size: wishlistItem.selectedSize,
                            price: product.Price,
                            stock: selectedSizeStock.quantity,
                            quantity: 1,
                            total: total,
                            addedAt: Date.now()
                        }],
                        cartTotal: total
                    });
        
                    await newCart.save();
                    console.log('New cart created:', newCart);
                } else {

                    const existingItem = cart.item.find(
                        item => item.productId.toString() === productId && item.size === wishlistItem.selectedSize
                    );
        
                    const wishlistItems = await Wishlist.findOne({ userId: userId }).populate('items.productId');
                    console.log('wishlist items',wishlistItems)

                    if (existingItem) {
                        console.log('Product already exists in the cart');
                        return res.render('wishlist',{
                            message:'Product Already in Cart',
                            wishlistItems: wishlistItems ? wishlistItems.items : [] 
                        })
                    }
        
          
                    cart.item.push({
                        productId: product._id,
                        size: wishlistItem.selectedSize,
                        price: product.Price,
                        stock: selectedSizeStock.quantity,
                        quantity: 1,
                        total: total,
                        addedAt: Date.now()
                    });
        
                    cart.cartTotal = cart.item.reduce((total, item) => total + item.total, 0);
        
                    await cart.save();
                    console.log('Product added to existing cart:', cart);
                }
        
                res.redirect('/cart');
            } catch (error) {
                console.log('Error while adding product to cart:', error);
                res.status(500).json({ message: 'An error occurred while adding the product to cart' });
            }
        };
        

        const loadWallet = async (req,res)=>{
          
            try {
                res.render('wallet')
            } catch (error) {
                
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
    loadWallet
}