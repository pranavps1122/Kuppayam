const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true
    },
    transactionsMethod: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order' // Reference to the Order model if needed
    },
    status: {
        type: String,
        enum: ['completed', 'pending'],
        default: 'completed'
    }
}, { timestamps: true });

const walletSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    balance: {
        type: Number,
        required: true,
        default: 0
    },
    transactions: [transactionSchema] // Add transactions field
}, { timestamps: true });



const Wallet = mongoose.model('Wallet', walletSchema);
module.exports = Wallet;

