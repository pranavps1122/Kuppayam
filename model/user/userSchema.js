const mongoose = require('mongoose');


const userSchema = mongoose.Schema({
    name :  {
        type: String,
        required: true,
        trim: true
    }
})


const user = mongoose.model('User',userSchema);

module.exports = user;