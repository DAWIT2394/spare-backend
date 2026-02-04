const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
  borrowerName: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  interestRate: {
    type: Number,
    default: 0,
  },
  loanDate: {
    type: Date,
    required: true,
  },
  returnDate: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'returned'],
    default: 'active',
  },
}, { timestamps: true });

module.exports = mongoose.model('Loan', loanSchema);
