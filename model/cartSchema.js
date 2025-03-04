const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    item: [
        {
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product',
                required: true,
            },
            quantity: {
                type: Number,
                required: true,
            },
            size: {
                type: String,
                required: true,
            },
            price: {
                type: Number,
                required: true,
            },
            stock: {
                type: Number,
                required: true,
            },
            total: {
                type: Number,
                required: true,
            },
        },
    ],
    cartTotal: {
        type: Number,
        required: true
    },
   
    appliedCoupon: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Coupon',
        default: null
    },
    discountAmount: {
        type: Number,
        default: 0
    },
    discountedTotal: {
        type: Number,
        default: function() {
            return this.cartTotal;
        }
    }
}, {timestamps: true});


cartSchema.pre('save', function(next) {
    if (this.discountAmount) {
        this.discountedTotal = this.cartTotal - this.discountAmount;
    } else {
        this.discountedTotal = this.cartTotal;
    }
    next();
});

module.exports = mongoose.model('Cart', cartSchema);