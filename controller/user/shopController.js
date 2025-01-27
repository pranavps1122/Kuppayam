const Category = require('../../model/categorySchema');
const { Product } = require('../../model/productSchema');
const Cart=require('../../model/cartSchema')
const Address = require('../../model/addressSchema')
const Order =require('../../model/orderSchema');
const { query } = require('express');


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

        // Fetch filtered products
        const products = await fetchProducts(sortCriteria, categoryFilter, searchTerm, skip, limit);

        // Count total products with the same filters
        const query = {};
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

        const totalProduct = await Product.countDocuments({
            ...query,
            ...filter,
        });

        const totalPages = Math.ceil(totalProduct / limit);

     
        res.render('shop', {
            categories,
            products,
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

const loadCheckout = async (req,res)=>{
    try {
        const userId = req.session.userId
       
        const cart = await Cart.findOne({userId:userId}).populate('item.productId')
        const address = await Address.find({ userId: userId });
 

        console.log('cart for checkout',cart)
        console.log('address',address)

  
    
       res.render('checkout',{
        cart,
        address,
       })
    } catch (error) {
        console.log('error while loading checkout page',error)
    }
   }
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
        res.render('orderSuccess',{
            
        })
    } catch (error) {
        
    }
}


const cancelorder = async (req, res) => {
    try {
        const userId = req.session.userId;
        const orderId = req.params.orderid;
        const productId = req.params.productid;

        const item = await Order.findOne({ 
            userId: userId, 
            _id: orderId 
        }).populate('orderedItem.productId');
        

        if (!item) {
            return res.status(404).render('orderStatus', {
                message: 'Order not found',
                order: null
            });
        }

        let itemIndex = item.orderedItem.findIndex((orderItem) => {
            return orderItem.productId._id.toString() === productId;
        });


        if (itemIndex === -1) {
            return res.render('orderStatus', {
                message: 'Product not found in this order',
                order: item
            });
        }

        const itemFound = item.orderedItem[itemIndex];

        const product = await Product.findById(productId);
        
        if (!product) {
            return res.status(404).render('orderStatus', {
                message: 'Product not found',
                order: item
            });
        }

        const sizeIndex = product.stock.findIndex((stock) => {
            return stock.size === itemFound.size;
        });

        
        if (sizeIndex !== -1) {
            product.stock[sizeIndex].quantity += itemFound.quantity;
            await product.save();
        }

        const updateProducts = await Order.updateOne(
            { _id: orderId },
            { 
                $set: { 
                    'orderedItem.$[item].productStatus': 'Cancelled' 
                } 
            },
            { 
                arrayFilters: [{ 'item.productId': productId }] 
            }
        );

        res.render('orderStatus', {
            message: 'Order cancelled successfully',
            order: item
        });
    } catch (error) {
        console.error('Error during order cancellation:', error);
        res.status(500).send('Internal Server Error');
    }
};



module.exports = {
    loadShop,
    loadCheckout,
    placeOrder,
    orderSuccess,
    cancelorder
};