const mongoose = require("mongoose");

const stockHistorySchema = new mongoose.Schema({
  partId: { type: mongoose.Schema.Types.ObjectId, ref: "SparePart" },
  type: { type: String, enum: ["IN", "OUT", "LOAN", "RETURN"] },
  quantity: Number,
  referenceId: String,
  note: String,
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model("StockHistory", stockHistorySchema);
