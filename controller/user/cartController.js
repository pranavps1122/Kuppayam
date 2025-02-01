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
                
                // Find product and verify it exists
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
                
                // Check for offers
                const offerProduct = await Offer.findOne({ productId: productId });
                const offerCategory = await Offer.findOne({ categoryId: categoryId });
                
                // Calculate discounted price and store discount information
                let discountedPrice = product.Price;
                let discountInfo = {
                    originalPrice: product.Price,
                    discountPercentage: 0,
                    discountType: null
                };
        
                if (offerProduct?.discount || offerCategory?.discount) {
                    const productDiscount = offerProduct?.discount || 0;
                    const categoryDiscount = offerCategory?.discount || 0;
                    
                    // Use the higher discount
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
        
                // Find the selected stock size
                const selectedStock = product.stock.find(item => item.size === size);
                if (!selectedStock) {
                    return res.render('cart', {
                        cart: await Cart.findOne({ userId }).populate('item.productId'),
                        message: 'Selected size not available'
                    });
                }
        
                // Find or create cart
                let cart = await Cart.findOne({ userId });
                if (!cart) {
                    cart = new Cart({ userId, item: [], cartTotal: 0 });
                }
        
                // Create new item with discount information
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
        
                // Check if item already exists in cart
                const populatedCart = await Cart.findOne({ userId }).populate('item.productId');
                const itemExists = cart.item.some(item => 
                    item.productId.toString() === productId && item.size === size
                );
        
                if (itemExists) {
                    return res.render('cart', {
                        cart: populatedCart,
                        message: 'Item already in cart'
                    });
                }
        
                // Add item to cart
                cart.item.push(newItem);
        
                // Recalculate cart total
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
            console.log('id of product',id)
            await Cart.updateOne({userId:userId},{$pull:{item:{_id:id}}})

            const updateCart=await Cart.findOne({userId:userId})

            console.log('updated cart',updateCart)

            updateCart.cartTotal = updateCart.item.reduce((acc, item) => acc + Number(item.total || 0), 0);
            console.log('updateCarttotal',updateCart.cartTotal)

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
        
                const cart = await Cart.findOne({ userId: userId, "item._id": itemId }).populate('item.productId');

                if (!cart) {
                    return res.status(404).send('Cart or item not found');
                }

            
                const itemIndex = cart.item.findIndex(item => item._id.toString() === itemId);

                if (itemIndex === -1) {
                    return res.status(404).send('Item not found in cart');
                }

                let item = cart.item[itemIndex];

            
                const newQuantity = item.quantity + updateQuantity;

                if (newQuantity > item.stock) {
                    return res.render('cart',{
                        cart,
                        message:`Product only has ${item.stock} stock available`
                    })
                }

                
                if (newQuantity <= 0) {
                    return res.status(400).send('Quantity must be at least 1');
                }


                cart.item[itemIndex].quantity = newQuantity;

        
                cart.cartTotal = cart.item.reduce((acc, item) => {
                    return acc + (item.price * item.quantity || 0);
                }, 0);

                await cart.save();

                console.log('Updated Cart:', cart);
                res.redirect('/cart');
            } catch (error) {
                console.error('Error updating quantity:', error);
                res.status(500).send('Error updating quantity');
            }
        };

        module.exports={
            loadCart,
            addtoCart,
            removeProduct,
            updateQuantity
        
        }