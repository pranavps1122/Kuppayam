const express = require('express')
const router = express.Router()
const multer = require('multer');
const adminController = require('../controller/admin/adminController')
const {userAuth,adminAuth}=require('../middlewares/auth')
const customerController = require('../controller/admin/customerController')
const categoryController =require('../controller/admin/categoryController')
const productController =require('../controller/admin/productController')
const path = require('path')

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/product-images'  ); 
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname); 
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, 
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp','image/avif']; 
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
router.get('/editCategory/:id',adminAuth,categoryController.loadEditCategory)
router.post('/editCategory/:id',categoryController.EditCategory)
router.post('/togglestatus', categoryController.togglestatus)
router.get('/products',adminAuth,productController.loadProductPage)
router.post('/Status',productController.Status )
router.get('/addproduct',adminAuth,productController.getProductAddPage)
router.post('/addproduct',upload.array('images',3),productController.addProduct)
router.post('/deleteProduct',productController.DelProduct)
router.get('/editProduct/:id',adminAuth,productController.loadEditProductPage)

// Update the edit product route to handle multiple images
router.post('/editProduct/:id', productController.editProduct);

router.get('/updateimage/:id',adminAuth,productController.updateImage)

router.post('/updateimages/:id',upload.array('images',3), productController.updateImagePost);

router.get('/ordermanagement',customerController.loadOrderManagement)

router.post('/updateOrderStatus',customerController.updateOrderStatus)


module.exports=router