const passport = require('passport');
const env = require('dotenv').config();
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../model/userSchema'); 

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID, 
    clientSecret: process.env.GOOGLE_CLIENT_SECRET, 
    callbackURL: 'http://localhost:3000/auth/google/callback',
   
}, async (accessToken, refreshToken, profile, done) => {
    try {
       
        let user = await User.findOne({ email: profile.emails[0].value,});
        console.log('google', user);

        if (user) {      
              user.name = profile.displayName;
              console.log('username',user.name)
             
              await user.save();
              console.log('pranav')
              return done(null, user); 
        }

        console.log('nikhil')


      
        user = new User({
            name: profile.displayName, 
            email: profile.emails[0].value,
            googleId: profile.id,
        });
        
        console.log('userrr', user);
        await user.save(); 
        return done(null, user);
    } catch (error) {
        return done(error, null); 
    }
}));


passport.serializeUser((user, done) => {
    done(null, user.id);
});


passport.deserializeUser((id, done) => {
    User.findById(id)
        .then(user => {
            done(null, user); 
        })
        .catch(err => {
            done(err, null); 
        });
});

module.exports = passport;
