const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    couponCode: {
        type: String,
        required: true,
        uppercase: true,
        unique: true,  
        trim: true     
    },
    discount: {
        type: Number,
        min: 0,
        max: 100,
        required: true,
    },
    minimumPrice: {
        type: Number,
        required: true,
        min: 0   
    },
    maxRedeem: {
        type: Number,
        required: true,
        min: 1    
    },
    expiry: {
        type: Date,
        required: true,
        validate: {  
            validator: function(value) {
                return value > Date.now();
            },
            message: 'Expiry date must be in the future'
        }
    },
    status: {
        type: Boolean,
        required: true,
        default: true
    },
    createdAt: {  
        type: Date,
        default: Date.now
    }
});


couponSchema.index({ couponCode: 1, status: 1 });
couponSchema.index({ expiry: 1 }, { expireAfterSeconds: 0 });


couponSchema.pre('save', async function(next) {
    if (this.isModified('couponCode')) {
        const existingCoupon = await this.constructor.findOne({ 
            couponCode: this.couponCode 
        });
        if (existingCoupon && existingCoupon._id.toString() !== this._id.toString()) {
            next(new Error('Coupon code already exists'));
        }
    }
    next();
});


couponSchema.methods.isValid = function() {
    return this.status && this.expiry > Date.now();
};

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;