    const User = require('../../model/userSchema')
    const mongoose = require('mongoose')
    const bcrypt = require('bcrypt')
    const { session } = require('passport')

    const adminError = async (req,res)=>{
        res.render('adminError')
    }

    const loadLogin = (req,res)=>{
        if(req.session.admin){
            return res.redirect('/admin/dashboard')
        }
        res.render('admin-login',{message:null})
    }

    const login = async (req,res) =>{
        try {
            const {email,password}=req.body
            const admin = await User.findOne({email,isAdmin:true})
            if(admin){
                const passwordMatch = await bcrypt.compare(password,admin.password);
                if(passwordMatch){
                    req.session.admin = { _id: admin._id, name: admin.name }
                    req.session.isAdmin=true
                    return res.redirect('/admin/dashboard')
                }else{
                    return res.render('admin-login',
                        {message:'Password not maching'})
                }
            }else{
                return res.render('admin-login', {message:'Email not matching'})
            }
        } catch (error) {
            return res.redirect('/pageNotFound')
        }
    }

    const loadDashboard = async (req, res) => {
        if (req.session.admin) {
            const admin=req.session.admin
            try {
                res.render('admin-dashboard', { admin,active:'dashboard'});
            } catch (error) {
                res.redirect('/pageNotFound');
            }
        } else {
            res.redirect('/admin/login');
        }
    };

    const logout = async (req,res)=>{
        try {
            req.session.destroy(err=>{
                if(err){
                    return res.redirect('/adminError')
                }else{
                    res.redirect('/admin/login')
                }
            })
        } catch (error) {
            res.redirect('/adminError')
        }
    }

    const loadCustomers = async (req, res) => {
        try {
            if (!req.session.admin) {
                return res.redirect('/admin/login');
            }
            const users = await User.find({ isAdmin: false });
            res.render('customers', { user: req.session.admin, users });
        } catch (error) {
            return res.redirect('/adminError');
        }
    };
    const blockCustomer = async (req, res) => {
        try {
            const userId = req.query.userId;
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.redirect('/adminError'); 
            }
         
            const user = await User.findById(userId);
            if (!user) {
                return res.redirect('/adminError');
            }
    
         
            const updatedUser = await User.findByIdAndUpdate(
                userId,
                { $set: { Status: !user.Status } },
                { new: true } 
            );
    
            // Redirect to customers page
            res.redirect('/admin/customers');
        } catch (error) {
            console.error('Error blocking/unblocking user:', error);
            res.redirect('/adminError');
        }
    };
    
    
    
    module.exports ={
        loadLogin,
        login,
        loadDashboard,
        adminError,
        logout,
        loadCustomers,
        blockCustomer,
    }