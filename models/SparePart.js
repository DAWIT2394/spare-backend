const mongoose = require("mongoose");

const sparePartSchema = new mongoose.Schema({
  name: String,
  code: { type: String, unique: true },
  category: String,
  quantity: { type: Number, default: 0 },
  minStock: Number,
  unitPrice: Number,
  supplier: String,
  location: String
}, { timestamps: true });

module.exports = mongoose.model("SparePart", sparePartSchema);
