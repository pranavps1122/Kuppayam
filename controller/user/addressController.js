const Address=require('../../model/addressSchema')
const User=require('../../model/userSchema')





const loadAddress= async (req,res) => {
    
    const user=await User.findOne({email:req.session.email})
    
   
    
    try {
        res.render('address',{
            user,
            message:null
            
        })
    } catch (error) {
        
    }

}


const addAddress = async (req, res) => {
    const {street, city, state, postalCode, country, fullName, number} = req.body;
    const userId = req.session.userId;
    

    if (fullName && fullName.startsWith(' ')) {
        return res.status(400).json({
            success: false,
            message: 'Full name cannot start with a space'
        });
    }
    if (state && state.startsWith(' ')) {
        return res.status(400).json({
            success: false,
            message: 'State cannot start with a space'
        });
    }

    if (postalCode && postalCode.startsWith(' ')) {
        return res.status(400).json({
            success: false,
            message: 'Post code cannot start with a space'
        });
    }

    if (number && number.startsWith(' ')) {
        return res.status(400).json({
            success: false,
            message: 'Number cannot start with a space'
        });
    }
    if (country && country.startsWith(' ')) {
        return res.status(400).json({
            success: false,
            message: 'Country cannot start with a space'
        });
    }
    if (city && city.startsWith(' ')) {
        return res.status(400).json({
            success: false,
            message: 'City cannot start with a space'
        });
    }
    
   
    if (street && street.startsWith(' ')) {
        return res.status(400).json({
            success: false,
            message: 'Street address cannot start with a space'
        });
    }

    if (!fullName || !street || !city || !state || !postalCode || !country || !number) {
        return res.status(400).json({
            success: false,
            message: 'All fields are required'
        });
    }
    
    
    if (!/^\d+$/.test(postalCode)) {
        return res.status(400).json({
            success: false,
            message: 'Postal code must contain only numbers'
        });
    }
    
    // Basic phone validation
    if (!/^[+\d\s()-]{10,}$/.test(number)) {
        return res.status(400).json({
            success: false,
            message: 'Please enter a valid phone number'
        });
    }

    try {
        const newAddress = new Address({
            street,
            city,
            state,
            postalCode,
            country,
            fullName,
            phoneNumber: number,
            userId
        });

        await newAddress.save();
        console.log('address added', newAddress);
        
        return res.status(200).json({
            success:true,
            message:'Address added sucessfully',
            
        })
        
       
        
        
        
    } catch (error) {
        console.log('error while adding address', error);
    
        return res.redirect('/address/add');
    }
};


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
        const {street,city,state,postalCode,country,fullname,number}=req.body
        console.log('req.body',req.body)
        console.log('req.params',id)


        if (!fullname || !street || !city || !state || !postalCode || !country || !number) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        if (!/^[+\d\s()-]{6,}$/.test(postalCode)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid PostalCode'
            });
        }

        if (fullname && fullname.startsWith(' ')) {
            return res.status(400).json({
                success: false,
                message: 'Full name cannot start with a space'
            });
        }
        if (state && state.startsWith(' ')) {
            return res.status(400).json({
                success: false,
                message: 'State cannot start with a space'
            });
        }
    
        if (postalCode && postalCode.startsWith(' ')) {
            return res.status(400).json({
                success: false,
                message: 'Post code cannot start with a space'
            });
        }
    
        if (number && number.startsWith(' ')) {
            return res.status(400).json({
                success: false,
                message: 'Number cannot start with a space'
            });
        }
        if (country && country.startsWith(' ')) {
            return res.status(400).json({
                success: false,
                message: 'Country cannot start with a space'
            });
        }
        if (city && city.startsWith(' ')) {
            return res.status(400).json({
                success: false,
                message: 'City cannot start with a space'
            });
        }
        
       
        if (street && street.startsWith(' ')) {
            return res.status(400).json({
                success: false,
                message: 'Street address cannot start with a space'
            });
        }
    
     
        
        
        if (!/^\d+$/.test(postalCode)) {
            return res.status(400).json({
                success: false,
                message: 'Postal code must contain only numbers'
            });
        }
        
        // Basic phone validation
        if (!/^[+\d\s()-]{10,}$/.test(number)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid phone number'
            });
        }
    
       

        const newAddress={
            street,
            city,
            state,
            postalCode,
            country,
            fullName:fullname,
            number
        }
        console.log('new address',newAddress)
        await Address.findByIdAndUpdate(id, newAddress, { new: true });
        
        return res.status(200).json({
            success:true,
            message:'Address added sucessfully',
            
        })
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



const checkoutAddress = async (req,res)=>{

    try {
        const{fullname,street,city,state,postalCode,country,number}=req.body
        const userId=req.session.userId


        
        if (!fullname || !street || !city || !state || !postalCode || !country || !number) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        if (!/^[+\d\s()-]{6,}$/.test(postalCode)) {
            return res.json({
                success: false,
                message: 'Please enter a valid PostalCode'
            });
        }

        if (fullname && fullname.startsWith(' ')) {
            return res.json({
                success: false,
                message: 'Full name cannot start with a space'
            });
        }
        if (state && state.startsWith(' ')) {
            return res.json({
                success: false,
                message: 'State cannot start with a space'
            });
        }
    
        if (postalCode && postalCode.startsWith(' ')) {
            return res.json({
                success: false,
                message: 'Post code cannot start with a space'
            });
        }
    
        if (number && number.startsWith(' ')) {
            return res.json({
                success: false,
                message: 'Number cannot start with a space'
            });
        }
        if (country && country.startsWith(' ')) {
            return res.json({
                success: false,
                message: 'Country cannot start with a space'
            });
        }
        if (city && city.startsWith(' ')) {
            return res.json({
                success: false,
                message: 'City cannot start with a space'
            });
        }
        
       
        if (street && street.startsWith(' ')) {
            return res.json({
                success: false,
                message: 'Street address cannot start with a space'
            });
        }
    
     
        
        
        if (!/^\d+$/.test(postalCode)) {
            return res.json({
                success: false,
                message: 'Postal code must contain only numbers'
            });
        }
        
        // Basic phone validation
        if (!/^[+\d\s()-]{10,}$/.test(number)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid phone number'
            });
        }
        const newAddress = new Address({
            fullName:fullname,
            street,
            city,
            state,
            postalCode,
            country,
            phoneNumber:number,
            userId
        })
        console.log('new address',newAddress)
        await newAddress.save()
        return res.json({success:true,message:'address added'})
    }   catch (error) {
            console.log('error while adding address', error);
            return res.json({ success: false, message: 'Failed to add address' });
        }
        
    
  
}
module.exports={
    loadAddress,
    addAddress,
    loadeditAddress,
    editAddress,
    deleteAddress,
    checkoutAddress
}