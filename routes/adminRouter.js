const express = require('express')
const router = express.Router()
const multer = require('multer');
const adminController = require('../controller/adminController')
const {userAuth,adminAuth}=require('../middlewares/auth')
const customerController = require('../controller/customerController')
const categoryController =require('../controller/categoryController')
const productController =require('../controller/productController')
const path = require('path')

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/product-images'  ); // Directory for storing uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname); // Unique file names
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']; // Correct MIME type
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, PNG, GIF, and WebP files are allowed'));
        }
    },
});



router.get('/adminError',adminController.adminError)
router.get('/login',adminController.loadLogin)
router.post('/login',adminController.login)
router.get('/',adminAuth,adminController.loadDashboard)
router.get('/dashboard',adminAuth ,adminController.loadDashboard);
router.get('/logout',adminAuth,adminController.logout)
router.get('/customers',adminAuth, customerController.customerInfo);
router.get('/blockUser',adminAuth,adminController.blockCustomer);
router.get('/category',adminAuth,categoryController.categoryInfo)
router.get('/addCategory',adminAuth,categoryController.loadAddCategory)
router.post('/addcategory',categoryController.addCategory)
router.post('/deleteCategory',categoryController.deleteCategory)
router.get('/editCategory/:id',categoryController.loadEditCategory)
router.post('/editCategory/:id',categoryController.EditCategory)
router.post('/Active',categoryController.Active)
router.post('/inActive',categoryController.inActive)
router.get('/products',adminAuth,productController.loadProductPage)
router.post('/toggleStatus',productController.toggleProductStatus )
router.get('/addproduct',productController.getProductAddPage)
router.post('/deleteProduct',productController.DelProduct)
router.get('/editProduct/:id',productController.loadEditProductPage)
router.post('/addproduct',upload.array('images',3),productController.addProduct)
router.post('/editProduct/:id',productController.editProduct)


module.exports=router