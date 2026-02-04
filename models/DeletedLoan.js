const mongoose = require('mongoose');

const DeletedLoanSchema = new mongoose.Schema({
  originalId: {
    type: String,
    required: true
  },
  loanData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  deletedBy: {
    type: String,
    default: 'System'
  },
  deletedAt: {
    type: Date,
    default: Date.now
  },
  restoreUntil: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
  },
  isRestored: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('DeletedLoan', DeletedLoanSchema);