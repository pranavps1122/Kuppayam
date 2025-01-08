const { kStringMaxLength } = require('buffer');
const mongoose = require('mongoose');
const { Schema } = mongoose;

const productSchema = new Schema({
    productName: { 
        type: String, 
        required: true 
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category', // Ensuring it references the Category model
        required: true
    },
    regularPrice: {
        type: Number,
        required: true
    },
    salePrice: {
        type: Number,
        required: true
    },
    productOffer: {
        type: Number,
        default: 0
    },
    quantity: {
        type: Number, // Changed default to a number
        default: 0 // Default value changed to 0 for quantity
    },
    color: {
        type: String,
        required:true
       
    },
    size: {
        type: String,
        required:true
        
    },
    productImage: {
        type: [String], // Array of strings
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    status: {
        type: String,
        enum: ['Available', 'Out of stock', 'Discontinued'], // Corrected spelling of "Discontinued"
       
        default: 'Available'
    }
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema); // Corrected to mongoose.model

module.exports = {
    Product
};
