const SparePart = require("../models/SparePart");

/**
 * CREATE spare part (ADMIN only)
 * POST /spareparts
 */
exports.create = async (req, res) => {
  try {
    const { name, quantity, price, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Spare part name is required" });
    }

    // Prevent duplicate part names
    const exists = await SparePart.findOne({ name });
    if (exists) {
      return res.status(400).json({ message: "Spare part already exists" });
    }

    const part = await SparePart.create({
      name,
      quantity: quantity || 0,
      price: price || 0,
      description,
    });

    res.status(201).json(part);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET all spare parts (Authenticated users)
 * GET /spareparts
 */
exports.getAll = async (req, res) => {
  try {
    const parts = await SparePart.find().sort({ createdAt: -1 });
    res.json(parts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * UPDATE spare part (ADMIN only)
 * PUT /spareparts/:id
 */
exports.update = async (req, res) => {
  try {
    const part = await SparePart.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!part) {
      return res.status(404).json({ message: "Spare part not found" });
    }

    res.json(part);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * DELETE spare part (ADMIN only)
 * DELETE /spareparts/:id
 */
exports.remove = async (req, res) => {
  try {
    const part = await SparePart.findByIdAndDelete(req.params.id);

    if (!part) {
      return res.status(404).json({ message: "Spare part not found" });
    }

    res.json({ message: "Spare part deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
