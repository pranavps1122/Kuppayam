    const Category = require('../model/categorySchema')
const { findOneAndUpdate } = require('../model/userSchema')



    const categoryInfo = async (req,res)=>{

       try {
        const page = parseInt(req.query.page) || 1
        const limit = 5
        const skip = (page-1)*limit
        const categories = await Category.find().sort({createdAt:-1})
        
        .skip(skip)
        .limit(limit)     

        const totalCategories = await Category.countDocuments()

        const totalPage = Math.ceil (totalCategories/limit) 
        res.render('category',{
            cat:categories,
            currentPage:page,
            totalPages : totalPage,
            totalCategories:totalCategories
        })
       

       } catch (error) {
        
        console.log(error);
        res.redirect('/admin/adminError')
        

       }

    }

    const loadAddCategory = async (req,res) =>{

        res.render('addCategory')
    }



    const addCategory = async (req,res)=>{

        const {description,categoryName,status}= req.body

        try {

            const existingCategory= await Category.findOne({categoryName})

            if(existingCategory){
                return res.render('addCategory',{message:'Category Already Exists'})
            }

            if (!categoryName) {
                return res.render('addCategory', { message: 'Category name is required' });
            }

            const newCategory = new Category ({
                description,
                categoryName,
                status
            })
            console.log('Request Body:', req.body);
            console.log('New Category:', newCategory);
           console.log('Saving new category:',  await newCategory.save())
           return  res.redirect('/admin/category')
            
        } catch (error) {
            console.error('Error adding category:', error)
            return res.redirect('/admin/adminError')
        }

    }



    const deleteCategory = async (req,res)=>{
        console.log('hdd',req.body)
        const categoryName = req.body.name

            

        try {
            await Category.findOneAndDelete({ categoryName: new RegExp(`^${categoryName}$`, 'i') });
           
            res.redirect('/admin/category')
            console.log('deleted',categoryName)


        } catch (error) {
            
            console.log('error while deleting Category',error)
            res.redirect('/admin/adminError')
        }


    }

    const loadEditCategory = async (req,res)=>{
        const {id } = req.params;

        let category = await Category.findById(id);

        console.log(category)
        if(!category) {
            res.send('not found')
        }


        res.render('editCategory', {category})
   
        
    }



    const EditCategory = async(req,res)=>{

        const {id} = req.params;
        
        const {categoryName,description}=req.body 
        

        const newCategory = {
            categoryName,
            description
        }

       await Category.findByIdAndUpdate(id, newCategory, {
            new: true, // Return the updated document
          });
        

        res.redirect('/admin/category')
        
        try {
            
        } catch (error) {
            
        }
    }
 

   


    
const Active = async (req, res) => {
    try {
        const { id } = req.body; // Get the user ID from the request body
        await Category.findByIdAndUpdate(id, { isActive: true }); // Block the user
        res.redirect('/admin/category'); // Redirect back to the customers page
    } catch (error) {
        console.log('Error blocking user:', error);
        res.redirect('/adminError');
    }
};

const inActive = async (req, res) => {
    try {
        const { id } = req.body; // Get the user ID from the request body
        await Category.findByIdAndUpdate(id, { isActive: false }); // Unblock the user
        res.redirect('/admin/category'); // Redirect back to the customers page
    } catch (error) {
        console.log('Error unblocking user:', error);
        res.redirect('/adminError');
    }
};







module.exports={
    categoryInfo,
    addCategory,
    loadAddCategory,
    deleteCategory,
    EditCategory,
    loadEditCategory,
    inActive,
    Active
    
    
}