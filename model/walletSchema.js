const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    balance: {
        type: Number,
        required: true,
        default: 0, 
        min: 0, 
    },
    transactions: [
        {
            type: {
                type: String,
                enum: ['credit', 'debit'], 
                required: true,
            },
            amount: {
                type: Number,
                required: true,
                min: 0.01,
            },
            date: {
                type: Date,
                default: Date.now,
            },
            description: {
                type: String,
                trim: true,
                maxlength: 200,
            },
        },
    ],
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});


walletSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Wallet', walletSchema);
