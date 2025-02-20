const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [
        {
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product', 
                required: true
            },
            selectedSize: {
                type: String,
                required: true
            },
            addedAt: {
                type: Date,
                default: Date.now
            }
        }
    ],
    // wallet: {
    //     balance: {
    //         type: Number,
    //         required:false
    //     },
        // userId: {
        //     type: mongoose.Schema.Types.ObjectId,
        //     ref: 'User',
        //     required: true
        // }
    // }
}, { timestamps: true });

module.exports = mongoose.model('Wishlist', wishlistSchema);
