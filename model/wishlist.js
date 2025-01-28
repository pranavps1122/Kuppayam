const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Refers to the User model
        required: true
    },
    items: [
        {
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product', // Refers to the Product model
                required: true
            },
            addedAt: {
                type: Date,
                default: Date.now
            },
            selectedSize:{
                type:String,
                required:true
            }
        }
    ]
});

const Wishlist = mongoose.model('Wishlist', wishlistSchema);

module.exports = Wishlist;
