const User=require('../model/userSchema')

const path = require('path');


const userAuth =(req,res,next)=>{
    if(req.session.user){
        User.findById(req.session.user)
        .then(data=>{
            if(data && !data.isBlocked){
                next()
            }else{
                res.redirect('/login')
            }
        })
        .catch(error=>{
            console.log(('Error in User Auth Middleware',error));
            res.status(500).send('Internal Server error')
            
        })
    }else{
        res.redirect('/login')
    }
}


const adminAuth = (req,res,next)=>{
    User.findOne({isAdmin:true})
    .then(data=>{
        if(data){
            next()
        }else{
            res.redirect('/admin/login')
        }
    })
    .catch(error=>{
        console.log('Error in admin Auth Middleware',error);
        res.status(500).send('Internal Server Error')
        
    })
}



module.exports ={
    userAuth,
    adminAuth
}