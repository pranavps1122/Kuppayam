        const {Product} =require('../../model/productSchema')
        const User=require('../../model/userSchema')
        const Cart=require('../../model/cartSchema')
        const Address=require('../../model/addressSchema')
        const Offer =require('../../model/offerSchema')

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
                const id = req.params.id;
                const { size } = req.body; 
                const userId = req.session.userId;
                console.log('product size:', size);
                const product = await Product.findOne({ _id: id, "stock.size": size });
                const offerProduct = await Offer.findOne({ productId: id});

                
              
                let discountedPrice = product.Price;

                
                if (offerProduct && offerProduct.discount) {
                    const discountAmount = Math.round(product.Price * offerProduct.discount / 100);
                    discountedPrice = product.Price - discountAmount;
                }

                console.log('fetched products', product);
                console.log('done');

                const selectedStock = product.stock.find((item) => {
                    return item.size == size;
                });

                console.log('SelectedStock', selectedStock);

                let cart = await Cart.findOne({ userId: userId });

                console.log('checking', cart);

                if (!cart) {
                    cart = new Cart({ userId: req.session.userId, item: [], cartTotal: 0 });
                    console.log('cart', cart);
                }
                const newItem = {
                    productId: id,
                    quantity: 1,
                    size: size,
                    price: discountedPrice,   // Use discounted price here
                    stock: selectedStock.quantity,
                    total: discountedPrice * 1,  // Total price based on quantity
                };
        

                const Caart = await Cart.findOne({ userId }).populate('item.productId');
                const itemExists = cart.item.some((item) => item.productId == id && item.size == size);
                
                if (itemExists) {
                    return res.render('cart', {
                        cart:Caart,
                        message : 'Item already in cart' });
                }

                if(product.quantity<=0||product.isActive==false){
                    return res.render('cart', {
                        cart:Caart,
                        message : 'Product Not Available' });
                }

                if(product.quantity>selectedStock.quantity){
                    return res.render('cart', {
                        cart:Caart,
                        message : `Product only has ${selectedStock.quantity} stock left for size ${size}` });
                }
                cart.item.push(newItem);

                cart.cartTotal = cart.item.reduce((acc, item) => acc + Number(item.total || item.price * item.quantity || 0), 0);
                console.log('cart.CartTotal', cart.cartTotal);

                await cart.save();
                console.log('Savedcart', cart);

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