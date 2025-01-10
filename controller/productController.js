const {Product} = require('../model/productSchema')
const Category = require('../model/categorySchema')
const User = require('../model/userSchema')
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
//const { console } = require('inspector')
const { CLIENT_RENEG_LIMIT } = require('tls')
const { log } = require('console')





const getProductAddPage = async (req,res)=>{
    try {
        const category = await Category.find({isActive:true})
        console.log('dgbhfjhh',category)
        console.log('Category',category)
        res.render('addProducts',{
            category
        })
    } catch (error) {
        res.redirect('/admin/adminError')
    }
}
const addProduct = async (req, res) => {
    console.error('dfjgbdfdfhgsdfgyfbh')
    try {
        const products = req.body;
        
        console.log('Received product data:', products);

        const productExists = await Product.find({
            
            productName: products.productName,
        });
        console.log("ppp",productExists)
        if (!productExists.length>0) {
            const images = [];
            if (req.files && req.files.length > 0) {
                for (let i = 0; i < req.files.length; i++) {
                    const originalImagePath = req.files[i].path;
                    const processedFileName = 'processed-' + req.files[i].filename;

                    const resizedImagePath = path.join(
                        'public',
                        'product-images',
                        processedFileName 
                    );

                    try {
                        await sharp(originalImagePath)
                            .resize({ width: 850, height: 850 })
                            .toFile(resizedImagePath);
                        images.push(resizedImagePath);
                    } catch (err) {
                        console.error('Error processing image:', err);
                        return res.status(500).json('Error while processing images');
                    }
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

           
            const imgArray =[]
            imgArray[0]= `product-images/${req.files[0].filename}`
            imgArray[1]= `product-images/${req.files[1].filename}`
            imgArray[2]= `product-images/${req.files[2].filename}`
          

            console.log('Creating product with data:', {
                productName: products.productName,
                description: products.description,
                category: categoryId._id,
                regularPrice: products.regularPrice,
                salePrice: products.salePrice,
                quantity: products.quantity,
                size: products.size,
                color: products.color,
                productImage: imgArray,
            });

            const newProduct = new Product({
                productName: products.productName,
                description: products.description,
                category: categoryId._id,
                regularPrice: products.regularPrice,
                salePrice: products.salePrice,
                createdOn: new Date(),
                quantity: products.quantity,
                size: products.size,
                color: products.color,
                status: 'Available',
                productImage:imgArray
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
const loadProductPage = async (req,res)=>{
    
    
    
   
    try {
      
      
        const products = await Product.find().populate('category');
      
      
       
       res.render('product',{
        products:products,
    
        
        
       })
        

        
        
    } catch (error) {
        res.redirect('/admin/adminError')
    }
}


const toggleProductStatus = async (req, res) => {
    console.log('ygyyuhgmvgygvnyrtcbvgcrg');
    
    try {
        const productId = req.body.id;
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).send("Product not found");
        }

        // Toggle the isActive status
        product.isActive = !product.isActive;

        await product.save(); // Save the updated product

        res.redirect('/admin/products'); // Redirect back to the product management page
    } catch (err) {
        console.error("Error updating product status:", err);
        res.status(500).send("Internal Server Error");
    }
};

const DelProduct = async (req,res)=>{
    try {
       const productId=req.body.id
       console.log('dfkhdfhjdf',productId)
        await Product.findByIdAndDelete({_id:productId})
        
        res.redirect('/admin/products')

        
    } catch (error) {
        
    }
}

 const loadEditProductPage = async (req, res) => {
    const productId = req.params.id;

    
    try {
       
        const product = await Product.findById(productId).populate('category');
        // Get all categories
        const categories = await Category.find({ isActive: true });
        
        res.render('editProduct', {
            product: product,
            categories: categories  // Pass all categories to the view
        });
        
    } catch (error) {
        console.error('Error loading edit product page:', error);
        res.redirect(`/admin/adminError?error=${encodeURIComponent(error.message)}`);
    }
}


    
    const editProduct = async (req,res)=>{

        console.log("hellooooo")

        try {
           
            const { id } = req.params;
            const { productName,quantity,salePrice,category} = req.body
          
            const newProduct={
                productName,
                quantity,
                category,         
                salePrice,
            
                
            }      


            console.log('new',newProduct)
            
            await Product.findByIdAndUpdate(id, newProduct,{
                new : true,
            })

          
            res.redirect('/admin/products')
            console.log('saved....')

        } catch (error) {
            console.error(error)
            
        }
    }


module.exports ={
    loadProductPage,
    addProduct,
    getProductAddPage,
    toggleProductStatus ,
    DelProduct,
    loadEditProductPage,
    editProduct
    
    
}