const Address=require('../../model/addressSchema')
const User=require('../../model/userSchema')





const loadAddress= async (req,res) => {
    
    const user=await User.findOne({email:req.session.email})
    
   
    
    try {
        res.render('address',{
            user,
            
        })
    } catch (error) {
        
    }

}

const addAddress= async (req,res)=>{

    const {street,city,state,postalCode,country}=req.body
    const userId =   req.session.userId 
    console.log('userId',userId)
    try {
        
        const newAddress = new Address ({
            street,
            city,
            state,
            postalCode,
            country,
            userId
            
        })

         await newAddress.save()
         console.log('address added',newAddress)
         return res.redirect('/profile')
    } catch (error) {
        console.log('error while adding address',error)
    }

}

const loadeditAddress = async (req,res)=>{
    const id =req.params.id
    const user=await User.findOne({email:req.session.email })
    const address = await Address.findById(id)
    console.log('Pranavpsaddress',address)
    try {
        res.render('editAddress',{
            user, 
            address
        })
    } catch (error) {
       console.log('error while loading edit page',error) 
    }

}

const editAddress= async(req,res)=>{
 
  
    try {
        const id=req.params.id
        const {street,city,state,postalCode,country}=req.body
        console.log('req.body',req.body)
        console.log('req.params',id)
       

        const newAddress={
            street,
            city,
            state,
            postalCode,
            country
        }
        console.log('new address',newAddress)
        await Address.findByIdAndUpdate(id, newAddress, { new: true });
        
        return res.redirect('/profile')
    } catch (error) {
        console.log('error while updating the address',error)
    }
}

const deleteAddress = async(req,res)=>{
        const id=req.params.id
        console.log('delete id',id)
       try {
    

        await Address.findByIdAndDelete(id)
        return res.redirect('/profile')
       } catch (error) {
        console.log('error while deleteing address',error)
       }

}

module.exports={
    loadAddress,
    addAddress,
    loadeditAddress,
    editAddress,
    deleteAddress
}