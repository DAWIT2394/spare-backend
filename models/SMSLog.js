// // models/SMSLog.js
// const mongoose = require('mongoose');

// const smsLogSchema = new mongoose.Schema({
//   type: {
//     type: String,
//     enum: ['single', 'batch', 'loan_reminder'],
//     required: true
//   },
//   phoneNumber: String,
//   message: String,
//   recipients: [{
//     phoneNumber: String,
//     name: String
//   }],
//   result: mongoose.Schema.Types.Mixed,
//   provider: String,
//   success: Boolean,
//   error: String,
//   userId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now
//   }
// });

// module.exports = mongoose.model('SMSLog', smsLogSchema);