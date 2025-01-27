        const User= require('../../model/userSchema')
        const nodemailer = require('nodemailer');
        const env=require('dotenv').config()
        const bcrypt=require('bcrypt')
        const {Product} = require('../../model/productSchema');
        const { block } = require('sharp');


        const loadHomepage = async (req, res) => {
            try {
                const products = await Product.find({}).limit(8)            

               
                res.render("home", {
                
                    products: products,
                });
                
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
                from:process.env.NODEMAILER_EMAIL,
                to:email,
                subject:"Verify Your Account",
                text:`Your Otp Is ${otp}`,
                html:` <b>Your Otp ${otp}</b> `
                
            
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
                    console.log('heloooo')
                    console.log(req.session.forgot)
                    if(req.session.forgot){
                        console.log('entering forgot')
                        return res.json({ success: true, redirectUrl: '/newpassword' });

                    }
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
                    return res.render('login', { message: 'Invalid email or password' });
                }
        
                if (!user.Status) {
                    return res.render('login', { message: 'Your account has been suspended. Please contact support.' });
                }
        
              
                const isMatch = await bcrypt.compare(password, user.password);
                if (!isMatch) {
                    return res.render('login', { message: 'Invalid email or password' });
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

        const LoadproductDetaill = async (req,res)=>{
            
            try {
                 const id = req.params.id
                 const user = req.session.user;
                 const product = await Product.findById(id)
                 const relatedProducts = await Product.find({
                    category: product.category,   
                    _id: { $ne: id },             
                }).limit(4);                             
                
                
                res.render('productDetail',{
                    product,
                    relatedProducts,
                    productId:id,
                    user
                })
            } catch (error) {
                console.log(error)
            }
        }

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
        
                let otp;
        
                if (user) {
                    otp = generateOtp(); 
                    const emailSent = await sendVerificationEmail(email, otp);
                    console.log('email', emailSent);
                }
        
                req.session.userOtp = otp; 
                req.session.forgot=true
                console.log('otp', otp);
        
                res.render('verify-otp', {
                    userData: user
                });
            } catch (error) {
                console.log('error while generating otp', error);
            }
        };

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
          
            
        }