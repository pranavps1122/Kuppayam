        const User= require('../../model/userSchema')
        const nodemailer = require('nodemailer');
        const env=require('dotenv').config()
        const bcrypt=require('bcrypt')
        const {Product} = require('../../model/productSchema');
        const { block } = require('sharp');
        const Offer = require('../../model/offerSchema');
        const Category = require('../../model/categorySchema');


        const loadHomepage = async (req, res) => {
            try {
                const products = await Product.find({}).limit(8).populate('category');
                
           
                const topSellingProducts = await Product.find({}).sort({ sales: -1 }).limit(4).populate('category'); // Assuming 'sales' is a field that tracks sales count
                
                const productIds = products.map(p => p._id);
                const categoryIds = products.map(p => p.category?._id).filter(id => id); 
        
              
                const productOffers = await Offer.find({ productId: { $in: productIds }, status: true });
                const categoryOffers = await Offer.find({ categoryId: { $in: categoryIds }, status: true });

        
              
                const processedProducts = products.map(product => {
                    const productOffer = productOffers.find(o => o.productId.toString() === product._id.toString());
                    const categoryOffer = categoryOffers.find(o => o.categoryId.toString() === product.category?._id.toString());
        
                    let productDiscount = productOffer ? Math.round(product.Price * productOffer.discount / 100) : 0;
                    let categoryDiscount = categoryOffer ? Math.round(product.Price * categoryOffer.discount / 100) : 0;
        
                    const bestDiscount = Math.max(productDiscount, categoryDiscount);
                    const bestDiscountPercentage = bestDiscount === productDiscount 
                        ? productOffer?.discount 
                        : categoryOffer?.discount;
        
                    return {
                        ...product.toObject(),
                        discountAmount: bestDiscount,
                        finalPrice: product.Price - bestDiscount,
                        discountPercentage: bestDiscountPercentage || 0,
                        discountType: bestDiscount === productDiscount ? 'product' : 'category',
                        originalPrice: product.Price
                    };
                });
        
          
                const processedTopSellingProducts = topSellingProducts.map(product => {
                    const productOffer = productOffers.find(o => o.productId.toString() === product._id.toString());
                    const categoryOffer = categoryOffers.find(o => o.categoryId.toString() === product.category?._id.toString());
        
                    let productDiscount = productOffer ? Math.round(product.Price * productOffer.discount / 100) : 0;
                    let categoryDiscount = categoryOffer ? Math.round(product.Price * categoryOffer.discount / 100) : 0;
        
                    const bestDiscount = Math.max(productDiscount, categoryDiscount);
                    const bestDiscountPercentage = bestDiscount === productDiscount 
                        ? productOffer?.discount 
                        : categoryOffer?.discount;
        
                    return {
                        ...product.toObject(),
                        discountAmount: bestDiscount,
                        finalPrice: product.Price - bestDiscount,
                        discountPercentage: bestDiscountPercentage || 0,
                        discountType: bestDiscount === productDiscount ? 'product' : 'category',
                        originalPrice: product.Price
                    };
                });
        
                res.render("home", { products: processedProducts, topSelling: processedTopSellingProducts });
        
            } catch (error) {
                console.log("Error While Running Home Page:", error);
                res.status(500).send("Server Error");
            }
        };
        

            
        const handleGoogleCallback = async (req, res) => {
            try {
                console.log('entering in handle google call back');
            
                req.session.userId=req.user._id
                req.session.email=req.user.email
                req.session.isAuth = true;

                

        
        
                res.redirect("/"); 
            } catch (error) {
                console.error("Google callback error:", error);
                res.redirect("/login");
            }
        };
        




        const loadSignup = async (req,res)=>{
            try {
                res.render('signup',{
                    message:null
                })
            } catch (error) {
                res.redirect('/pageNotFound')
                
            }
        }


        function generateOtp() {
            return Math.floor(10000 + Math.random() * 90000).toString();
        }
        
        async function sendVerificationEmail (email,otp){
            try {


                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    port: 587,
                    secure: false,
                    requireTLS: true, 
                    auth: {
                        user: process.env.NODEMAILER_EMAIL,
                        pass: process.env.NODEMAILER_PASSWORD,
                    },
                });
                
              const info= await transporter.sendMail({
                from: process.env.NODEMAILER_EMAIL,
                to: email,
                subject: "🚀 Verify Your Account - OTP Inside!",
                text: `Hello! 👋\n\nYour one-time password (OTP) is: ${otp}\n\nUse this to verify your account. This code will expire soon, so act fast! ⚡\n\nIf you didn't request this, please ignore this email.`,
                html: `
                    <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px; background-color: #f4f4f4;">
                        <h2 style="color: #333;">🔐 Verify Your Account</h2>
                        <p style="color: #555;">Use the OTP below to complete your verification process.</p>
                        <div style="display: inline-block; padding: 15px; font-size: 22px; font-weight: bold; color: #fff; background-color: #007bff; border-radius: 5px;">
                            ${otp}
                        </div>
                        <p style="color: #555; margin-top: 10px;">This OTP will expire soon. If you didn’t request this, please ignore this email.</p>
                        <p style="color: #777; font-size: 12px;">Need help? Contact our support team.</p>
                    </div>
                `
            
            }) 
            return info.accepted.length > 0
                
            } catch (error) {
                console.error('Error sending email',error);
                return false
            }
        }

        const signup = async (req,res)=>{
            try {

                const { name, email, password,phone } = req.body;

              
                
                const findUser= await User.findOne({email});
                if(findUser){
                    return res.status(400).render("signup", { message: "User with this email already exists" });

                }

                const otp= generateOtp()


                const emailSent = await sendVerificationEmail(email,otp)
                if(!emailSent){
                    return res.json('Email.error');

                }

                req.session.userOtp=otp;
                req.session.userData={ name, email, password,phone };

                
                console.log('Otp Sent',otp);
                res.render("verify-otp", { message: null, userData: { email } })     
                
            } catch (error) {
                console.error('Sign Error',error)
                res.redirect('/pageNotFound')
                
            }
        }

        const loadLogin = async (req, res) => {
            try {
                res.render('login', { message: null });
            } catch (error) {
                console.error('Error loading login page:', error);
                res.redirect('/pageNotFound');
            }
        }

        const pageNotFound = async (req,res)=>{
            try {
                res.render('page-404')
            } catch (error) {
                res.redirect('/pageNotFound')
            }
        }

        

        const verifyOtp = async (req, res) => {
            console.log('entering into verify otp')
            try {
                const { otp1, otp2, otp3, otp4, otp5 } = req.body;
                const submittedOtp = otp1 + otp2 + otp3 + otp4 + otp5;
                 
                if(submittedOtp !== req.session.userOtp){
                    return res.json({
                        success: false,
                        message: 'Invalid OTP'
                    });
                }
        
                if (submittedOtp === req.session.userOtp) {
                
                    const hashedPassword = await bcrypt.hash(req.session.userData.password, 10);
                    const newUser = new User({
                        name: req.session.userData.name,
                        email: req.session.userData.email,
                        password: hashedPassword,
                        phone: req.session.userData.phone
                    
                    });
                    await newUser.save()
        
                    delete req.session.userOtp;
                    delete req.session.userData;
        
                    return res.json({ success: true }); 
                }
        
                return res.json({
                    success: false,
                    message: 'Invalid OTP'
                });
            } catch (error) {
                console.error('OTP Verification Error:', error);
                return res.json({
                    success: false,
                    message: 'An error occurred'
                });
            }
        }



        const login = async (req, res) => {
            try {
                const { email, password } = req.body;
                console.log(req.body);
        
               
                const user = await User.findOne({ email });
                console.log('User found:', user);
        
                if (!user) {
                    return res.render('login', { 
                        message: 'User not found', 
                        messageType: 'error'
                    });
                    
                }

                if (!user.password) {
                    return res.render('login', { 
                        message: 'Please login with google', 
                        messageType: 'error' 
                    });
                    
                }
        
                if (!user.Status) {
                    return res.render('login', { 
                        message: 'User is blocked please contact', 
                        messageType: 'error' 
                    });
                    
                }
        
              
                const isMatch = await bcrypt.compare(password, user.password);
                if (!isMatch) {
                    return res.render('login', { 
                        message: 'Password is not matching', 
                        messageType: 'error' 
                    });
                }
        
                req.session.userId=user._id;
                req.session.name=user.name;
                req.session.email=user.email;
                req.session.isAuth=true
            
                res.redirect('/');
            } catch (error) {
                console.error('Login Error:', error);
                res.redirect('/pageNotFound');
            }
        };
        

        const resendOtp = async (req, res) => {
            try {
                const { email } = req.body; 
                const otp = generateOtp();

                const emailSent = await sendVerificationEmail(email, otp); 
                if (!emailSent) {
                    return res.json({ success: false, message: 'Failed to send OTP' });
                }

                
                req.session.userOtp = otp;

                console.log('New OTP Sent', otp);
                return res.json({ success: true });
            } catch (error) {
                console.error('Error resending OTP:', error);
                return res.json({ success: false, message: 'Error resending OTP' });
            }
        }


        const logout = async (req,res)=>{

            try {
                req.session.destroy((err)=>{
                    if(err){
                        console.log('session destroy error',err)
                       return res.redirect('/pageNotFound')
                    }
                    res.redirect('/login')
                })
            } catch (error) {
               console.log('logout error',error) 
               res.redirect('/pageNotFound')
            }
        }

        const LoadproductDetaill = async (req, res) => {
            try {
                const { productId } = req.params;
                const user = req.session.user;
                const categories = await Category.find();
                
                const product = await Product.findById(productId).populate('category');
                if (!product) {
                    return res.status(404).send('Product not found');
                }
                
               
                const productOffer = await Offer.findOne({ productId: productId, status: true });
                const categoryOffer = await Offer.findOne({ categoryId: product.category._id, status: true });
                
                let productDiscount = 0;
                let categoryDiscount = 0;
                let bestDiscount = 0;
                let bestDiscountPercentage = 0;
                let discountType = '';
                
                if (productOffer) {
                    productDiscount = Math.round(product.Price * productOffer.discount / 100);
                }
                
                if (categoryOffer) {
                    categoryDiscount = Math.round(product.Price * categoryOffer.discount / 100);
                }
               
                if (productDiscount >= categoryDiscount) {
                    bestDiscount = productDiscount;
                    bestDiscountPercentage = productOffer?.discount || 0;
                    discountType = 'product';
                } else {
                    bestDiscount = categoryDiscount;
                    bestDiscountPercentage = categoryOffer?.discount || 0;
                    discountType = 'category';
                }
                
             
                const finalPrice = product.Price - bestDiscount;
                
                const processedProduct = {
                    ...product.toObject(),
                    discountAmount: bestDiscount,
                    finalPrice: finalPrice,
                    discountPercentage: bestDiscountPercentage,
                    discountType: discountType,
                    originalPrice: product.Price
                };
                
                const relatedProducts = await Product.find({
                    category: product.category._id,
                    _id: { $ne: productId },
                }).limit(4);
                
                res.render('productDetail', {
                    product: processedProduct,
                    relatedProducts,
                    productId,
                    user,
                    categories,
                    isAuth: req.session.isAuth,
                    req:req
                });
            } catch (error) {
                console.error('Error while loading product details:', error);
                res.status(500).send('Internal Server Error');
            }
        };
        

        const loadForgotPassword = async (req,res)=>{

            try {
                res.render('forgotpassword',{
                    message:null
                })
            } catch (error) {
                console.log('error while loading forgot password page',error)
            }
        }

        const forgotPassword = async (req, res) => {
            try {
                const { email } = req.body;
                const user = await User.findOne({ email: email });
                if (!user) {
                    return res.render('forgotpassword', {
                        message: 'User not found'
                    });
                }

                const otp = generateOtp(); 
                const emailSent = await sendVerificationEmail(email, otp);
                console.log('email', emailSent);

                req.session.userOtp = otp; 
                req.session.forgot = true; 
                req.session.email=email
                console.log('otp', otp);

                res.render('forgot-verify', {
                    userData: user,
                    message: null
                });
            } catch (error) {
                console.log('error while generating otp', error);
            }
        };



        const verifyOtpForgot = async (req, res) => {
            try {
                const { otp } = req.body;
                const validOtp = req.session.userOtp;

                if (otp !== validOtp) {
                    return res.render('forgot-verify', {
                        message: 'Invalid OTP'
                    });
                }

            
                res.redirect('/newpassword'); 
            } catch (error) {
                console.log('error while verifying otp', error);
            }
        };
       
        const loadNewPassword = async (req,res)=>{

            try {
                res.render('new-password',{
                    message:null
                })
            } catch (error) {
              console.log('error while loading newpassword',error)  
            }
        }

        const updatePassword = async (req,res)=>{

            try {
             
              
                console.log('email',req.session.email)
               
                const{newPassword,confirmPassword}=req.body;
                if(newPassword!==confirmPassword){
                    return res.render('new-password',{
                        message:'Password does not match'
                    })
                }

                await User.findOneAndUpdate({email:req.session.email},{
                    password:await bcrypt.hash(newPassword,10)  
                })
                return res.render('login', { 
                    message: 'Password updated successfully', 
                    messageType: 'success'
                });
                
                delete req.session.userOtp;

            } catch (error) {
                console.log('error while updating password',error)
            }
        }

        const loadAbout = async (req,res)=>{

            try {
                res.render('about')
            } catch (error) {
                console.log('error while loading about page',error)
            }
        }

        const loadContact = async (req,res)=>{

            try {
              res.render('contact',{
                message:null,
                messageType:null
              })  
            } catch (error) {
                console.log('error while loading conatct',error)
            }
        }

        const sendMail =async(req,res)=>{

            try {
                console.log('req.body',req.body)
                const{name,email,message}=req.body;
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    port: 587,
                    secure: false,
                    requireTLS: true, 
                    auth: {
                        user: process.env.NODEMAILER_EMAIL,
                        pass: process.env.NODEMAILER_PASSWORD,
                    },
                });
                const mailOptions = {
                    from: email,
                    to: "your-email@gmail.com", 
                    subject: "New Contact Form Message",
                    text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
                };
                await transporter.sendMail(mailOptions);
                res.render('contact',{
                    message:'Mail Sent Successfully',
                    messageType:'success'
                })
            } catch (error) {
                console.log('error while sending mail',error)
            }
        }

        module.exports={
            loadHomepage,
            pageNotFound,
            loadSignup,
            loadLogin,
            signup,
            verifyOtp,
            login,
            resendOtp,
            logout,
            LoadproductDetaill,
            handleGoogleCallback,
            loadForgotPassword,
            forgotPassword,
            loadAbout,
            loadContact,
            verifyOtpForgot,
            loadNewPassword,
            updatePassword,
            sendMail,
           

            
          
            
        }