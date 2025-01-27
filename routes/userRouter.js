const express=require('express')
const router=express.Router()
const userController=require('../controller/user/userController')
const passport = require('passport')
const adminController = require('../controller/admin/adminController')
const {ifLogged,adminAuth, logged}=require('../middlewares/auth')
const profileController=require('../controller/user/profileController')
const addressController = require('../controller/user/addressController')
const cartController=require('../controller/user/cartController')
const shopController = require('../controller/user/shopController')


router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/login' }),
    userController.handleGoogleCallback
);
router.get('/',userController.loadHomepage)

router.get('/pageNotFound',userController.pageNotFound)

router.get('/signup',ifLogged,userController.loadSignup)
router.post('/signup',userController.signup)
router.get('/login',ifLogged,userController.loadLogin)
router.post('/login',userController.login)



router.post('/verify-otp', userController.verifyOtp);

router.post('/resend-otp', userController.resendOtp);

router.get('/productDetail/:id',userController.LoadproductDetaill)

router.get('/logout',logged,userController.logout)

router.get('/profile',logged,profileController.loadprofile)
router.get('/editprofile',logged,profileController.loadeditProfile)
router.post('/editprofile',logged,profileController.editprofile)
router.get('/address',logged,addressController.loadAddress)
router.post('/Address',logged,addressController.addAddress)

router.get('/editaddress/:id',logged,addressController.loadeditAddress)
router.post('/editaddress/:id',logged,addressController.editAddress)
router.get('/deleteaddress/:id',logged,addressController.deleteAddress)

router.get('/resetpassword',logged,profileController.loadresetpassword)
router.post('/resetpassword',logged,profileController.resetpassword)


router.get('/cart',logged,cartController.loadCart)
router.post('/cart/:id',logged,cartController.addtoCart)

router.get('/removeproduct/:id',cartController.removeProduct)


router.post('/updatequantity',logged,cartController.updateQuantity)



router.get('/shop',shopController.loadShop)



router.get('/Checkout',logged,shopController.loadCheckout)
router.post('/Checkout',logged,shopController.placeOrder)


router.get('/ordersuccess',logged,shopController.orderSuccess)

router.get('/orderDetails',logged,profileController.orderDetails)

router.get('/orderstatus/:id',logged,profileController.loadorderStatus)


router.get('/forgotpassword',userController.loadForgotPassword)
router.post('/forgotpassword',userController.forgotPassword)


router.get('/cancelorder/:orderid/:productid',logged,shopController.cancelorder)





module.exports=router