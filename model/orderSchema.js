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
            enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'Return Requested','Returned','Return Declined'],
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
    profit: {
        type: Number,
        default: 0,
        required: true
    },
    orginalPrice: {
        type: Number,
        default: 0
    },
   
    paymentMethod: {
        type: String,
        enum: ['COD', 'Online Payment', 'Wallet'],
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
    returnReason: { type: String, 
        default: null },
    razorpayOrderId: { type: String, 
        default: null },

  
    date: {
        type: Date,
        default: Date.now,
        required: true
    }
}, { 
    timestamps: true 
});

 
orderSchema.index({ userId: 1, date: -1 });


orderSchema.virtual('discountedAmount').get(function() {
    return this.orderAmount - this.couponDiscount; 
});


const Order = mongoose.model("orders", orderSchema);

module.exports = Order;