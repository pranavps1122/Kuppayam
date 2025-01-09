const express=require('express')
const router=express.Router()
const userController=require('../controller/userController')
const passport = require('passport')
const adminController = require('../controller/adminController')


router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
// router.get('/auth/google/callback', passport.authenticate('google', {
//     failureRedirect: '/signup'
// }), (req, res) => {
//     console.log('user session',req.user)
//     // Successful authentication, redirect to home or dashboard
//     res.redirect('/');
// });
router.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/login' }),
    userController.handleGoogleCallback
);

router.get('/pageNotFound',userController.pageNotFound)
router.get('/',userController.loadHomepage)
router.get('/signup',userController.loadSignup)
router.post('/signup',userController.signup)
router.get('/login',userController.loadLogin)
router.post('/login',userController.login)

router.post('/verify-otp', userController.verifyOtp);
router.post('/resend-otp', userController.resendOtp);
router.get('/productDetail/:id',userController.LoadproductDetaill)
router.get('/logout',userController.logout)


module.exports=router