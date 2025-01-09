const express=require('express')
const app=express()
const path=require('path')
const env=require('dotenv')
const session =require('express-session')
const passport=require('./config/passport')
const connectDB=require('./config/db')
const userRoute=require('./routes/userRouter')
const adminRoute=require('./routes/adminRouter')
const mongoose = require('mongoose')
const User = require('./model/userSchema')



connectDB()
env.config();

app.use(express.json())
app.use(express.urlencoded({extended:true}))

// Connect to MongoDB (if using MongoDB for session storage)
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });


app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60000 }  // Session expiration time in milliseconds
}));


app.use(passport.initialize());
app.use(passport.session());

app.use((req,res,next)=>{
    res.set('cache-control','no-store')
    next()
})
app.set('view engine','ejs')
app.set('views', [
    path.join(__dirname, 'views/user'),
    path.join(__dirname, 'views/admin')
]);

app.use(express.static(path.join(__dirname, 'public')));

app.use('/',userRoute)
app.use('/admin',adminRoute)

app.listen(process.env.PORT,()=>{
    console.log('server running')
})

module.exports={
    app,
 
}