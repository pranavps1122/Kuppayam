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
        ref: 'Category', 
        required: true
    },
    Price: {
        type: Number,
        required: true
    },
    stock: [
        {
            quantity: {
                type: Number,
                required:true
            },
            size: {
                type: String,
                required: true
            }
        }
    ],


    totalStock:{
     type:Number,
     required:true
    },
      productImage: {
        type: [String], 
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    status: {
        type: String,
        enum: ['Available', 'Out of stock', 'Discontinued'], 
        default: 'Available'
    }
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema); 

module.exports = {
    Product
};
