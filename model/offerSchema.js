const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema({
    offerType: {
        type: String,
        enum: ["product", "category", "referral"], 
        required: true
    },

    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        validate: {
            validator: function(value) {
                return this.offerType !== 'product' || value != null;
            },
            message: 'Product ID is required for product-type offers'
        }
    },

    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        validate: {
            validator: function(value) {
                return this.offerType !== 'category' || value != null;
            },
            message: 'Category ID is required for category-type offers'
        }
    },

    referralCode: {
        type: String,
        unique: true,  // Keep unique constraint
        sparse: true,  // Avoid errors when it's null
        required: function() {
            return this.offerType === 'referral';
        }
    },

    discount: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },

    startDate: {
        type: Date,
        required: true
    },

    endDate: {
        type: Date,
        required: true,
        validate: {
            validator: function(value) {
                return value > this.startDate;
            },
            message: "End date must be after start date."
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
    },

    redeemCount: {
        type: Number,
        default: 0,
        min: 0
    },

    maxRedemptions: {
        type: Number,
        default: null,
        min: 1
    }
});

// Only add index if it doesn't already exist
if (!offerSchema.indexes().some(idx => JSON.stringify(idx[0]) === JSON.stringify({ referralCode: 1 }))) {
    offerSchema.index({ referralCode: 1 }, { unique: true, sparse: true });
}

const Offer = mongoose.model("Offer", offerSchema);

module.exports = Offer;
