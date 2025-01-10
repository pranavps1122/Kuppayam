const User=require('../model/userSchema')

const path = require('path');


const ifLogged =(req,res,next)=>{
    try {
        if(req.session.isAuth){
            res.redirect('/')
        }else{
            next()
        }
    } catch (error) {
        console.log('error occured',error);
    }
}




const adminAuth = (req,res,next)=>{
    try {
        if(req.session.isAdmin){
            next()
        }else{
            res.redirect("/admin/login")
        }
    } catch (error) {
        console.log("error occured while validating the admin");
    }
}



module.exports ={
    ifLogged,
    adminAuth,
    
}