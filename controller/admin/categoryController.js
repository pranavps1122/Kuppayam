    const Category = require('../../model/categorySchema')
const { findOneAndUpdate, exists } = require('../../model/userSchema')



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
            path: '/admin/category',
            title: 'Products',
            currentPage:page,
            totalPages : totalPage,
            totalCategories:totalCategories,
            admin: req.session.admin, // Ensure admin data is passed correctly
            active: 'category'  
        })
       
      

       } catch (error) {
        
        console.log(error);
        res.redirect('/admin/adminError')
        

       }

    }

    const loadAddCategory = async (req,res) =>{
        
        res.render('addCategory',{
            message:null
        })
    }



    const addCategory = async (req,res)=>{

        const {description,categoryName,status}= req.body

        try {
           
                const normalizedName =categoryName.trim().toLowerCase();

                
                const existingCategory = await Category.findOne({ 
                    categoryName: { $regex: new RegExp(`^${normalizedName}$`, 'i') } 
                });

                if (existingCategory) {
                    return res.render('addCategory', { message: 'Category Already Exists' });
                }

            if (!categoryName) {
                return res.render('addCategory', { message: 'Category name is required' });
            }

              if (/\s/.test(categoryName)) {
                return res.render('addCategory', { message: 'Avoid white spaces' });
           }
            
            

            const newCategory = new Category ({
                description,
                categoryName,
                status
            })
    
             await newCategory.save()
           return  res.redirect('/admin/category')
            
        } catch (error) {
            console.log('error',error)
            return res.redirect('/admin/adminError')
        }

    }



    const deleteCategory = async (req,res)=>{
      
        const categoryName = req.body.name

            

        try {
            await Category.findOneAndDelete({ categoryName: new RegExp(`^${categoryName}$`, 'i') });
           
            res.redirect('/admin/category')
       


        } catch (error) {
            
            res.redirect('/admin/adminError')
        }


    }

    const loadEditCategory = async (req,res)=>{
        const {id } = req.params;

        let category = await Category.findById(id);

        
        if(!category) {
            res.send('not found')
        }


        res.render('editCategory', {
            category,
            message:null
        })
   
        
    }



    const EditCategory = async(req,res)=>{

        const {id } = req.params;

        let category = await Category.findById(id);

       
        
        const {categoryName,description}=req.body 

        const exist = await Category.find({categoryName})
        
       console.log('name',categoryName)
        

       if(categoryName==''){
        return res.render('editCategory',{
            message:'Enter a valid name',
            category
            
        
        })
       }

       if(/\s/.test(categoryName)){

        return res.render('editCategory',{
            message:'Space not allowed',
            category
            
        
        })
        
       }


        
        if(exist){
            return res.render('editCategory',{
                message:'Category Already Exists',
                category
            })
        }
        if(!categoryName.length===0){
            return res.render('editCategory',{
                message:'Enter A Name',
                category
                
            
            })
        }

       
        const newCategory = {
            categoryName,
            description
        }
       
       await Category.findByIdAndUpdate(id, newCategory, {
            new: true, 
          });
        

        res.redirect('/admin/category')
        
        try {
            
        } catch (error) {
            
        }
    }
 

   


    
    const togglestatus = async (req, res) => {
        try {
            const { id } = req.body;
            const category = await Category.findById(id);
            await Category.findByIdAndUpdate(id, { isActive: !category.isActive });
            res.redirect('/admin/category');
        } catch (error) {
            console.log('Error toggling category status:', error);
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
    togglestatus
    
    
}