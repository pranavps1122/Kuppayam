        const {Product} =require('../../model/productSchema')
        const User=require('../../model/userSchema')
        const Cart=require('../../model/cartSchema')
        const Address=require('../../model/addressSchema')
        const Offer =require('../../model/offerSchema')
        const Category = require('../../model/categorySchema')
  
        const loadCart = async (req, res) => {
            try {
                const userId =req.session.userId 
                
                
                if (!userId) {
                    return res.redirect('/login');
                }


                const cart = await Cart.findOne({ userId }).populate('item.productId');
                console.log('updatedcart',cart)


                res.render('cart', {
                    cart,
                    message:null
                    
                });
            } catch (error) {
                console.error('Error while loading cart:', error);
                res.status(500).send('Internal Server Error');
            }
        };


        const addtoCart = async (req, res) => {
            try {
                console.log('entering the cart');
                const { productId, categoryId } = req.params;
                const { size } = req.body;
                const userId = req.session.userId;
                
                console.log('product size:', size);
                
                const product = await Product.findOne({ _id: productId, "stock.size": size });
                
                if (!product) {
                    return res.render('cart', {
                        cart: await Cart.findOne({ userId }).populate('item.productId'),
                        message: 'Product not found'
                    });
                }
                
                if(!product.isActive){
                    return res.render('cart', {
                        cart: await Cart.findOne({ userId }).populate('item.productId'),
                        message: 'Product is not available'
                    });
                }
            


                const category = await Category.findById(categoryId);
                if(!category.isActive){
                    return res.render('cart', {
                        cart: await Cart.findOne({ userId }).populate('item.productId'),
                        message: 'Product is not available'
                    });
                }
             
                const offerProduct = await Offer.findOne({ productId: productId });
                const offerCategory = await Offer.findOne({ categoryId: categoryId });
                
                let discountedPrice = product.Price;
                let discountInfo = {
                    originalPrice: product.Price,
                    discountPercentage: 0,
                    discountType: null
                };
        
                if (offerProduct?.discount || offerCategory?.discount) {
                    const productDiscount = offerProduct?.discount || 0;
                    const categoryDiscount = offerCategory?.discount || 0;
                    
                    
                    const discount = Math.max(productDiscount, categoryDiscount);
                    const discountAmount = Math.round(product.Price * (discount / 100));
                    discountedPrice = product.Price - discountAmount;
                    
                    discountInfo = {
                        originalPrice: product.Price,
                        discountPercentage: discount,
                        discountType: productDiscount > categoryDiscount ? 'product' : 'category',
                        categoryName: category.name
                    };
                }
        
              
                const selectedStock = product.stock.find(item => item.size === size);
                if (!selectedStock) {
                    return res.render('cart', {
                        cart: await Cart.findOne({ userId }).populate('item.productId'),
                        message: 'Selected size not available'
                    });
                }
        
             
                let cart = await Cart.findOne({ userId });
                if (!cart) {
                    cart = new Cart({ userId, item: [], cartTotal: 0 });
                }
        
               
                const newItem = {
                    productId: productId,
                    quantity: 1,
                    size: size,
                    price: discountedPrice,
                    stock: selectedStock.quantity,
                    total: discountedPrice * 1,
                    discountInfo: discountInfo,
                    categoryId: categoryId
                };
        
                const populatedCart = await Cart.findOne({ userId }).populate('item.productId');
                const itemExists = cart.item.some(item => 
                    item.productId.toString() === productId && item.size === size
                );
        
                if (itemExists) {
                    return res.render('cart', {
                        cart: await Cart.findOne({ userId }).populate('item.productId'),
                        
                        message: 'Item already in cart'
                    });
                }
        
                cart.item.push(newItem);
        
              
                cart.cartTotal = cart.item.reduce((acc, item) => 
                    acc + Number(item.total || item.price * item.quantity || 0), 0
                );
        
                await cart.save();
                res.redirect('/cart');
        
            } catch (error) {
                console.error('Error while adding to cart:', error);
                res.status(500).send('Internal Server Error');
            }
        };
        const removeProduct = async (req,res)=>{

            try {
            const userId=req.session.userId || req.session.user.id
            const id =req.params.id 
        
            await Cart.updateOne({userId:userId},{$pull:{item:{_id:id}}})

            const updateCart=await Cart.findOne({userId:userId})

        

            updateCart.cartTotal = updateCart.item.reduce((acc, item) => acc + Number(item.total || 0), 0);
           

            await updateCart.save()
            
            
            
            res.redirect('/cart')

            } catch (error) {
                console.log('error while removing ')
            }
        }


        const updateQuantity = async (req, res) => {
            const { itemId, action } = req.body;
            const userId = req.session.userId || req.session.user.id;

            const updateQuantity = action === 'increase' ? 1 : -1;

            try {
                const cart = await Cart.findOne({ userId });

                if (!cart) {
                    return res.status(404).json({ success: false, message: 'Cart not found' });
                }

                const itemIndex = cart.item.findIndex(item => item._id.toString() === itemId);

                if (itemIndex === -1) {
                    return res.status(404).json({ success: false, message: 'Item not found in cart' });
                }

                let item = cart.item[itemIndex];

                const product = await Product.findById(item.productId);
                if (!product) {
                    return res.status(404).json({ success: false, message: 'Product not found' });
                }

                const selectedStock = product.stock.find(stockItem => stockItem.size === item.size);
                if (!selectedStock) {
                    return res.status(404).json({ success: false, message: 'Stock information not found' });
                }

                const newQuantity = item.quantity + updateQuantity;

                // Check stock availability
                if (newQuantity > selectedStock.quantity) {
                    return res.status(400).json({ success: false, message: `Only ${selectedStock.quantity} left in stock` });
                }

                if (newQuantity <= 0) {
                    cart.item.splice(itemIndex, 1); // Remove item if quantity is 0
                } else {
                    cart.item[itemIndex].quantity = newQuantity;
                    cart.item[itemIndex].total = newQuantity * cart.item[itemIndex].price; // Update total
                }

                // Update cart total
                cart.cartTotal = cart.item.length > 0 
                    ? cart.item.reduce((acc, item) => acc + (item.total || 0), 0)
                    : 0;

                await cart.save();
                res.json({ success: true, message: 'Cart updated successfully' });

            } catch (error) {
                console.error('Error updating quantity:', error);
                res.status(500).json({ success: false, message: 'Error updating quantity' });
            }
        };
        

        module.exports={
            loadCart,
            addtoCart,
            removeProduct,
            updateQuantity
        
        }