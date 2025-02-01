const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema({
    offerType: {
        type: String,
        enum: ["product", "category", "referral"], 
        required: true
    },
    // Add these new fields
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        // Only required if offerType is "product"
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
    // Rest of your schema remains the same
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
    }
});
const Offer = mongoose.model("Offer", offerSchema);

module.exports = Offer;
