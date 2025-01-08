const User = require('../model/userSchema')
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
        console.log('Attempting to log in with email:', email); // Log the email being used
        const admin = await User.findOne({email,isAdmin:true})
        console.log('Admin found:', admin)
        if(admin){

            

            const passwordMatch =  bcrypt.compare(password,admin.password);
            if(passwordMatch){
                console.log('Before setting session:', req.session);
                req.session.admin = { _id: admin._id, name: admin.name };
                console.log('After setting session:', req.session); // Log the admin session
                return res.redirect('/admin/dashboard')
            }else{
                return res.redirect('/admin/login')
            }
        }else{
            return res.redirect('/admin/login')
        }
    } catch (error) {
        console.log('Error while login:', error);
        return res.redirect('/pageNotFound')
        
    }
}




const loadDashboard = async (req, res) => {
    if (req.session.admin) {
        try {
            // Pass the admin user to the view
            res.render('admin-dashboard', { user: req.session.admin }); // Pass the admin session data
        } catch (error) {
            console.log('Error while rendering dashboard:', error);
            res.redirect('/pageNotFound');
        }
    } else {
        res.redirect('/admin/login'); // Redirect to login if not authenticated
    }
};

const logout = async (req,res)=>{
    try {
        req.session.destroy(err=>{
            if(err){
                console.log('error while logout')
                return res.redirect('/adminError')
            }else{
                res.redirect('/admin/login')
            }
        })
    } catch (error) {
        console.log('Unexpected Error',error)
        res.redirect('/adminError')
    }
}


const loadCustomers = async (req, res) => {
    try {
        if (!req.session.admin) {
            return res.redirect('/admin/login'); // Redirect to login if not authenticated
        }

        // Fetch users from the database
        const users = await User.find({ isAdmin: false }); // Adjust the query as needed
        console.log('Fetched users:', users); // Log the fetched users
        res.render('customers', { user: req.session.admin, users }); // Pass both admin and users to the view
    } catch (error) {
        console.log('Error loading customers:', error);
        return res.redirect('/adminError');
    }
};

const blockCustomer = async (req, res) => {
    try {
        const { id } = req.body; // Get the user ID from the request body
        await User.findByIdAndUpdate(id, { isBlocked: true }); // Block the user
        res.redirect('/admin/customers'); // Redirect back to the customers page
    } catch (error) {
        console.log('Error blocking user:', error);
        res.redirect('/adminError');
    }
};

const unblockCustomer = async (req, res) => {
    try {
        const { id } = req.body; // Get the user ID from the request body
        await User.findByIdAndUpdate(id, { isBlocked: false }); // Unblock the user
        res.redirect('/admin/customers'); // Redirect back to the customers page
    } catch (error) {
        console.log('Error unblocking user:', error);
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
    unblockCustomer

    
}