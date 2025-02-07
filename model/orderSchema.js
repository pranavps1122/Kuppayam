const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const orderSchema = new mongoose.Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    cartId: {
        type: Schema.Types.ObjectId,
        ref: 'Cart'
    },
    orderedItem: [{
        productId: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
        },
        size: {
            type: String,
            required: true,
        },
        productPrice: {
            type: Number,
            required: true,
        },
        productStatus: {
            type: String,
            enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
            default: "pending",
            required: true
        },
        totalProductPrice: {
            type: Number,
            required: true
        },
        itemDiscount: {
            type: Number,
            default: 0
        }
    }],
    deliveryAddress: {
        type: Array,
        required: true
    },
    orderAmount: {
        type: Number,
        required: true
    },
    totalDiscount: {
        type: Number,
        default: 0
    },
   
    paymentMethod: {
        type: String,
        enum: ['COD', 'Online Payment','Wallet'],
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed'],
        default: 'pending'
    },
    paymentId: {
        type: String
    },
    couponCode: {
        type: String,
        default: ""
    },
    couponDiscount: {
        type: Number,
        default: 0
    },
  
    date: {
        type: Date,
        default: Date.now,
        required: true
    }
}, { 
    timestamps: true 
});

// Add an index for faster queries
orderSchema.index({ userId: 1, date: -1 });

// Virtual for calculating total amount with discount
orderSchema.virtual('discountedAmount').get(function() {
    return this.orderAmount - this.totalDiscount;
});

const Order = mongoose.model("orders", orderSchema);

module.exports = Order;