const User =require('../model/userSchema')

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
const logged = async (req, res, next) => {
    try {
        const user = await User.findOne({ email: req.session.email });
        console.log('user:', user);

        if (user && req.session.isAuth) {
            if (user.Status) {
             
                next();
            } else {
             
                req.session.destroy(err => {
                    if (err) {
                        console.log('Error destroying session:', err);
                        return res.render('login', {
                             message: 'Error logging out blocked user',
                             messageType: 'error'

                             });
                    }
                    res.render('login', { message: 'User is Blocked',
                        messageType: 'error'


                     });
                });
            }
        } else {
           
            res.render('login', { message: 'Please log in',
            messageType: 'error'
             });
        }
    } catch (error) {
        console.log('Error in middleware:', error);
        res.render('login', { message: 'An error occurred, please log in again' });
    }
};




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
    logged
    
}