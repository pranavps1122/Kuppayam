const User = require('../model/userSchema')





const customerInfo = async (req,res)=>{
    try {
        

        let search =""
        if(req.query.search){
            search=req.query.search;

        }

        let page = parseInt(req.query.page) || 1;
        const limit = 5;

        const userData = await User.find({
            isAdmin:false,
            $or:[
                {name:{$regex:'.*'+search+'.*'}},
                {email:{$regex:'.*'+search+'.*'}}
            ]
        })

        .limit(limit)
        .skip((page-1)*limit)
        .exec();

        const count = await User.find({
            isAdmin:false,
            $or:[
                {name:{$regex:'.*'+search+'.*'}},
                {email:{$regex:'.*'+search+'.*'}}
            ]
        }).countDocuments();

        const totalPages = Math.ceil(count / limit);

        res.render('customers', { user: req.session.admin, users: userData, search: search, count: count, totalPages: totalPages, currentPage: page });

    } catch (error) {
        console.log('Error fetching customer info:', error);
        res.redirect('/adminError');
    }
}



module.exports={
    customerInfo
}
