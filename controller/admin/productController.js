        const { Product } = require('../../model/productSchema');
        const Category = require('../../model/categorySchema');
        const User = require('../../model/userSchema');
        const fs = require('fs');
        const path = require('path');
        // Removed sharp import
        const { CLIENT_RENEG_LIMIT } = require('tls');
        const { log } = require('console');

        const loadProductPage = async (req, res) => {
     
            const page = parseInt(req.query.page) || 1; 
            const limit = 5; 
            const skip = (page - 1) * limit;
        
            const totalProducts = await Product.countDocuments(); 
            const totalPages = Math.ceil(totalProducts / limit);
        
            const products = await Product.find()
                .populate('category')
                .skip(skip)
                .limit(limit);
        
                res.render('product', {
                    path: '/admin/products',
                    title: 'Products',
                    products,
                    currentPage: page,
                    totalPages,
                    admin: req.session.admin, 
                    active: 'products'        
                });
                
        };
        
        const getProductAddPage = async (req, res) => {
            try {
                const category = await Category.find({ isActive: true });
                res.render('addProducts', {
                    category,
                    message: null,
                    admin: req.session.admin,
                    active: 'product',
                });
            } catch (error) {
                res.redirect('/admin/adminError');
            }
        };

        const addProduct = async (req, res) => {
            try {
                const category = await Category.find({ isActive: true });
                const products = req.body;

                console.log('Received product data:', products);

                const productExists = await Product.find({
                    productName: products.productName,
                });

                if (products.productName === '') {
                    return res.render('addProducts', {
                        message: 'Enter a valid product name',
                        category,
                    });
                }

                // if (/\s/.test(products.productName)) {
                //     return res.render('addProducts', {
                //         message: 'Avoid white spaces',
                //         category,
                //     });
                // }

                if (!products.productName || !isNaN(Number(products.productName))) {
                    return res.render('addProducts', {
                        message: 'Avoid numbers',
                        category,
                    });
                }

                const lettersOnly = /^[A-Za-z\s]+$/;

                if (!lettersOnly.test(products.productName)) {
                    return res.render('addProducts', {
                        message: 'Enter a valid product name (letters only)',
                        category,
                    });
                }

                if (products.Price < 1) {
                    return res.render('addProducts', {
                        message: 'Enter a valid price',
                        category,
                    });
                }

                if (!productExists.length > 0) {
                    const images = [];
                    if (req.files && req.files.length > 0) {
                      
                        for (let i = 0; i < req.files.length; i++) {
                            const imagePath = path.join('public', 'product-images', req.files[i].filename);
                            images.push(imagePath);
                        }
                    } else {
                        return res.status(400).json('No images uploaded');
                    }

                    console.log('Category name being searched:', products.category);
                    const categoryId = await Category.findById(products.category);

                    console.log('Found category:', categoryId);

                    if (!categoryId) {
                        console.error('Category not found for name:', products.category);
                        return res.status(400).json(`Category '${products.category}' not found`);
                    }

                    const imgArray = [];
                    imgArray[0] = `product-images/${req.files[0].filename}`;
                    imgArray[1] = `product-images/${req.files[1].filename}`;
                    imgArray[2] = `product-images/${req.files[2].filename}`;



                    
                    const totalStock= parseInt(products.size_s)+parseInt(products.size_m)+parseInt(products.size_l)+parseInt(products.size_xl)

                    const newProduct = new Product({
                        productName: products.productName,
                        description: products.description,
                        category: categoryId._id,
                        Price: products.Price,
                        createdOn: new Date(),
                        stock: [
                            {
                                size: 'S',
                                quantity: products.size_s
                            },
                            {
                                size: 'M',
                                quantity: products.size_m
                            },
                            {
                                size: 'L',
                                quantity: products.size_l
                            },
                            {
                                size: 'XL',
                                quantity: products.size_xl
                            }
                        ],

                        

                        totalStock,
                        status: 'Available',
                        productImage: imgArray,
                    });

                    await newProduct.save();
                    return res.redirect('/admin/products');
                } else {
                    return res.status(400).json('Product already exists, try again');
                }
            } catch (error) {
                console.error('Error while adding product:', error);
                res.redirect(`/admin/adminError?error=${encodeURIComponent(error.message)}`);
            }
        };

        const Status = async (req, res) => {
            try {
                const productId = req.body.id;
                const product = await Product.findById(productId);

                if (!product) {
                    return res.status(404).send("Product not found");
                }

                product.isActive = !product.isActive;

                await product.save();

                res.redirect('/admin/products');
            } catch (err) {
                console.error("Error updating product status:", err);
                res.status(500).send("Internal Server Error");
            }
        };

        const DelProduct = async (req, res) => {
            try {
                const productId = req.body.id;
                await Product.findByIdAndDelete({ _id: productId });
                res.redirect('/admin/products');
            } catch (error) {
                console.error('Error deleting product:', error);
            }
        };

        const loadEditProductPage = async (req, res) => {
            const productId = req.params.id;
            try {
                const product = await Product.findById(productId).populate('category');
                const categories = await Category.find({ isActive: true });

                res.render('editProduct', {
                    product: product,
                    categories: categories,
                    admin: req.session.admin,
                    active: 'product',
                });
            } catch (error) {
                console.error('Error loading edit product page:', error);
                res.redirect(`/admin/adminError?error=${encodeURIComponent(error.message)}`);
            }
        };

        const editProduct = async (req, res) => {
            try {
                const { id } = req.params;
                const { productName, quantity_s, quantity_m, quantity_l, quantity_xl, Price, category } = req.body;
        
              
                const size_s = parseInt(quantity_s) || 0;
                const size_m = parseInt(quantity_m) || 0;
                const size_l = parseInt(quantity_l) || 0;
                const size_xl = parseInt(quantity_xl) || 0;
        
                const totalStock = size_s + size_m + size_l + size_xl;
        
                
                const product = await Product.findById(id);
        
             
                const updatedStock = product.stock.map(stockItem => {
                    if (stockItem.size === 'S') stockItem.quantity = size_s;
                    if (stockItem.size === 'M') stockItem.quantity = size_m;
                    if (stockItem.size === 'L') stockItem.quantity = size_l;
                    if (stockItem.size === 'XL') stockItem.quantity = size_xl;
                    return stockItem;
                });
        
                const newProduct = {
                    productName,
                    category,
                    stock: updatedStock, 
                    Price,
                    totalStock
                };
        
                console.log('Updated product data:', newProduct);
        
                await Product.findByIdAndUpdate(id, newProduct, { new: true });
        
                console.log('Product updated successfully');
                res.redirect('/admin/products');
            } catch (error) {
                console.error('Error updating product:', error);
                res.status(500).send('Internal Server Error');
            }
        };
        
        const updateImage = async (req, res) => {
            try {
                const id = req.params.id;
                const products = await Product.findById(id);

                if (!products) {
                    return res.status(404).send('Product not found');
                }

                console.log('products:', products);

                if (!products.productImage) {
                    products.productImage = [];
                }

                res.render('updateimage', {
                    products: products,
                });
            } catch (error) {
                console.error('Error in updateImage:', error);
                res.status(500).send('Internal Server Error');
            }
        };

        const updateImagePost = async (req, res) => {
            try {
                console.log("updating the image from the admin side");
                const id = req.params.id;
                const product = await Product.findById(id);

                if (!product) {
                    return res.status(404).json({ error: 'Product not found' });
                }

                const uploadedFiles = req.files;
                if (!uploadedFiles || uploadedFiles.length === 0) {
                    return res.status(400).json({ error: 'No files uploaded' });
                }

                const newImages = uploadedFiles.map(file => `product-images/${file.filename}`);

                product.productImage = newImages;
                await product.save();

                console.log("Product updated with new images:", product);

                res.redirect('/admin/products');
            } catch (error) {
                console.error("Error occurred while updating product images:", error);
                res.status(500).json({ error: 'Failed to update images' });
            }
        };

        module.exports = {
            loadProductPage,
            addProduct,
            getProductAddPage,
            Status,
            DelProduct,
            loadEditProductPage,
            editProduct,
            updateImage,
            updateImagePost,
        };
