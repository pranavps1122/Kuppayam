const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const addressSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User', // Assuming you have a User model
        required: true
    },
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    phoneNumber: {
        type: String,
        required: true,
        trim: true
    },
    street: {
        type: String,
        required: true,
        trim: true
    },
    city: {
        type: String,
        required: true,
        trim: true
    },
    state: {
        type: String,
        required: true,
        trim: true
    },
    postalCode: {
        type: String,
        required: true,
        trim: true
    },
    country: {
        type: String,
        required: true,
        trim: true
    },
    isPrimary: {
        type: Boolean,
        default: false // Mark one address as primary
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Pre-save hook to update `updatedAt` field
addressSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Export Address model
const Address = mongoose.model('Address', addressSchema);
module.exports = Address;
