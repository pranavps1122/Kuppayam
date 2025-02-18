const express=require('express')
const app=express()
const path=require('path')
const env=require('dotenv')
const session =require('express-session')
const passport=require('./config/passport')
const connectDB=require('./config/db')
const userRoute=require('./routes/userRouter')
const adminRoute=require('./routes/adminRouter')

const nocache = require("nocache");



connectDB()
env.config();
app.use(nocache());
app.use(express.json())
app.use(express.urlencoded({extended:true}))




const PORT = process.env.PORT;

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60000*600 } 
}));


app.use((req,res,next)=>{
    res.locals.session=req.session
    next()
})

app.use(passport.initialize());
app.use(passport.session());


app.set('view engine','ejs')
app.set('views', [
    path.join(__dirname, 'views/user'),
    path.join(__dirname, 'views/admin')
]);

app.use(express.static(path.join(__dirname, 'public')));

app.use('/',userRoute)
app.use('/admin',adminRoute)

app.listen(process.env.PORT,()=>{
    console.log(`server is running at http://localhost:${PORT}`)
})

