const SparePart = require("../models/SparePart");
const StockHistory = require("../models/StockHistory");

// STOCK IN
exports.stockIn = async (req, res) => {
  try {
    const { partId, quantity, note } = req.body;

    const part = await SparePart.findById(partId);
    if (!part) {
      return res.status(404).json({ message: "Spare part not found" });
    }

    part.quantity += Number(quantity);
    await part.save();

    await StockHistory.create({
      partId,
      quantity,
      type: "IN",
      note,
    });

    res.json({ message: "Stock added successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// STOCK OUT
exports.stockOut = async (req, res) => {
  try {
    const { partId, quantity, note } = req.body;

    const part = await SparePart.findById(partId);
    if (!part) {
      return res.status(404).json({ message: "Spare part not found" });
    }

    if (part.quantity < quantity) {
      return res.status(400).json({ message: "Not enough stock" });
    }

    part.quantity -= Number(quantity);
    await part.save();

    await StockHistory.create({
      partId,
      quantity,
      type: "OUT",
      note,
    });

    res.json({ message: "Stock issued successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
