const User =require('../../model/userSchema')
const Address=require('../../model/addressSchema')
const bcrypt=require('bcrypt')
const Order = require('../../model/orderSchema')



const loadprofile = async (req,res) => {

    try {
       const user=await User.findOne({email:req.session.email })
       console.log('user',user)
       const address = await Address.find({userId:req.session.userId}); 
       console.log('address',address) 
      
        res.render('profile',{user,address})
       
    } catch (error) {
        console.log('skljfhjhf',error)
    }
}

const loadeditProfile = async (req,res)=>{
  
    try {
        const user=await User.findOne({email:req.session.email})

        const address = await Address.find({userId:req.session.userId}); 

        res.render('editprofile',{user,address})

    } catch (error) {
        
        console.log('error while loading profiledit page',error)
    }
}

const editprofile = async (req,res)=>{

    try {
        const {name,phone}=req.body
        const id=req.query.userId 
        console.log('editprofileid',id)
        const newUser={
            name,
            phone
        }
        await User.findByIdAndUpdate(id,newUser ,{
            new: true, 
          })
          res.redirect('profile')

    } catch (error) {
        console.log('error while updating profile',error)
    }
}

const loadresetpassword = async (req,res) => {
    
    const user=await User.findOne({email:req.session.email})

    try {
        res.render('resetpassword',{user})
    } catch (error) {
        
    }
}

const resetpassword = async (req,res)=>{
 try {
    const saltround=10
    const {currentpassword,confirmPassword,newPassword}=req.body
    const userId=req.session.userId 
    const user=await User.findOne({_id:userId})
    console.log('user:',user)

    const isMatch=await bcrypt.compare(newPassword,user.password)

    if(isMatch){
       res.redirect('/resetpassword')
  
    }else if(confirmPassword!==newPassword){
        res.redirect('/resetpassword')
        
    }else{
        const passwordMatch= await bcrypt.compare(currentpassword,user.password)
        if(passwordMatch){
            const hashedPassword=await bcrypt.hash(newPassword,saltround)
         let updated=await User.updateOne({_id:userId},{$set:{password:hashedPassword}})
         console.log('update Sucessfully',updated)
        }
    }
    res.redirect('/profile')

    } catch (error) {

        console.log('error while changing password',error)
        
    }

}

const orderDetails = async (req,res)=>{

    try {
        const user=await User.findOne({email:req.session.email })
        const orders = await Order.find().populate('orderedItem.productId')
        res.render('orderDetails',{
            orders,
            user
        })
    } catch (error) {
        console.log('error while running order page',error)
    }
}


const loadorderStatus = async (req, res) => {
    try {
      const productId = req.params.id;
      const userId = req.session.userId;
  
      const order = await Order.findById(productId)
        .populate('orderedItem.productId');
  
      res.render('orderStatus', {
        user: userId,
        order,
        message:null
      });
    } catch (error) {
      console.error('Error rendering orderStatus page:', error);
      res.status(500).send('Internal Server Error');
    }
  };
  
module.exports={
    loadprofile,
    loadeditProfile,
    editprofile,
    loadresetpassword,
    resetpassword,
    orderDetails,
    loadorderStatus
}