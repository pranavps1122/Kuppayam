        const User= require('../model/userSchema')
        const nodemailer = require('nodemailer');
        const env=require('dotenv').config()
        const bcrypt=require('bcrypt')
        const {Product} = require('../model/productSchema')


        const loadHomepage = async (req, res) => {
            try {
                const user = req.session.user;
                console.log // Get user from session
                console.log('User from session:', user); // Log user from session
                const products = await Product.find()
                console.log('product',products)
                
                if (user) {
                    const userData = await User.findOne({ _id: user._id });
                    
                    console.log('User data:', userData); // Log user data
                    res.render('home',
                         { user: userData || null,
                            products:products

                          }); // Pass userData to the view
                } else {
                    return res.render('home', 
                        { user: null,
                            products:products
                         }); // Pass null if no user
                }
            } catch (error) {
                console.log('Error While Running Home Page:', error);
                res.status(500).send("server Error");
            }
        };

            // Add this new function to handle Google auth callback
    const handleGoogleCallback = async (req, res) => {
        try {
            console.log("abcd")
            req.session.user = { 
                _id: req.user._id, 
                name: req.user.name 
            };
            console.log("aaaa",req.session.user)
            const products = await Product.find()
            console.log('product',products)
            req.session.isAuth=true;
          res.redirect("/") 
          
        } catch (error) {
            console.error('Google callback error:', error);
            res.redirect('/login');
        }
    };




        const loadSignup = async (req,res)=>{
            try {
                res.render('signup')
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

                const { name, email, password, cPassword,phone } = req.body;

                if(password!==cPassword){
                    return res.status(400).render("signup", { message: "Passwords do not match" });
                }

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
                res.render("verify-otp", { message: null, userData: { email } });

            
                
                
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
            try {
                const { otp1, otp2, otp3, otp4, otp5 } = req.body;
                const submittedOtp = otp1 + otp2 + otp3 + otp4 + otp5;

                if (submittedOtp === req.session.userOtp) {
                    // Create new user with session data
                    const hashedPassword = await bcrypt.hash(req.session.userData.password, 10);
                    const newUser = new User({
                        name: req.session.userData.name,
                        email: req.session.userData.email,
                        password: hashedPassword,
                        phone: req.session.userData.phone
                    });
                    console.log(await newUser.save());

                    // Clear session data
                    delete req.session.userOtp;
                    delete req.session.userData;

                    return res.redirect('/login'); // Redirect to login on successful verification
                }

                // Render the verify-otp page with an error message if OTP is invalid
                return res.render('verify-otp', { message: 'Invalid OTP', userData: { email: req.session.userData.email } });
            } catch (error) {
                console.error('OTP Verification Error:', error);
                res.redirect('/pageNotFound');
            }
        }

        
        const login = async (req, res) => {
            try {
                const { email, password ,isBlocked} = req.body;

                // Check if user exists
                const user = await User.findOne({ email });
                if (!user) {
                    return res.render('login', { message: 'Invalid email or password' });
                }

                const isMatch = await bcrypt.compare(password, user.password);
                if (!isMatch) {
                    return res.render('login', { message: 'Invalid email or password' });
                }


                if(user.isBlocked==true){
                   return res.render('login',{message:"User Blocked..."})
                }
                 

                // Set user session
                req.session.user = { _id: user._id, name: user.name }; // Store user data in session
                console.log('User session set:', req.session.user); // Log the session data
                req.session.isAuth=true;
                // Redirect to home page
                res.redirect('/');
            } catch (error) {
                console.error('Login Error:', error);
                res.redirect('/pageNotFound');
            }
        }

        const resendOtp = async (req, res) => {
            try {
                const { email } = req.body; // Get the email from the request body
                const otp = generateOtp(); // Generate a new OTP

                const emailSent = await sendVerificationEmail(email, otp); // Send the OTP email
                if (!emailSent) {
                    return res.json({ success: false, message: 'Failed to send OTP' });
                }

                // Update the session with the new OTP
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
               console.error('logout error') 
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
            handleGoogleCallback
        }