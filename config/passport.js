const passport = require('passport');
const env=require('dotenv').config()
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../model/userSchema'); // Adjust the path as necessary

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID, // Your Google Client ID
    clientSecret: process.env.GOOGLE_CLIENT_SECRET, // Your Google Client Secret
    callbackURL: 'http://localhost:3000/auth/google/callback' // This should match the callback route in userRouter.js
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Check if user already exists in the database
        let user = await User.findOne({ googleId: profile.id });
        if (user) {
            return done(null, user); // User found, return the user
        } else {
            // If not, create a new user
            user = new User({
                name: profile.displayName,
                email: profile.emails[0].value,
                googleId: profile.id,
            });
            await user.save(); // Save the new user to the database
            return done(null, user); // Return the new user
        }
    } catch (error) {
        return done(error, null); // Handle any errors
    }
}));

// Serialize user to store in session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser((id, done) => {
    User.findById(id)
        .then(user => {
            done(null, user); // Return the user object
        })
        .catch(err => {
            done(err, null); // Handle any errors
        });
});

module.exports = passport;