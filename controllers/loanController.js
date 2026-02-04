const LoanSparePart = require("../models/LoanSparePart");
const SparePart = require("../models/SparePart");
const DeletedLoan = require("../models/DeletedLoan"); // Add this import

// Create a new loan (multiple items, no partId stored)
exports.createLoan = async (req, res) => {
  try {
    const { 
      borrowerName, 
      borrowerPhone, 
      borrowerType = "Mechanic", 
      expectedReturnDate, 
      note, 
      items 
    } = req.body;

    // Basic validation
    if (!borrowerName || !borrowerName.trim()) {
      return res.status(400).json({ message: "Borrower name is required" });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "At least one item is required" });
    }

    let loanItems = [];
    let grandTotal = 0;

    // Process each item
    for (const item of items) {
      const { 
        partName, 
        partCode, 
        measurement = "piece", 
        quantity, 
        unitPrice,
        description 
      } = item;

      // Validate required fields
      if (!partName || !partName.trim()) {
        return res.status(400).json({ message: "Item name is required for all items" });
      }

      if (!quantity || quantity <= 0) {
        return res.status(400).json({ message: `Valid quantity required for ${partName}` });
      }

      if (!unitPrice || unitPrice < 0) {
        return res.status(400).json({ message: `Valid unit price required for ${partName}` });
      }

      // Validate measurement-specific requirements
      if (measurement === "piece") {
        if (!Number.isInteger(quantity)) {
          return res.status(400).json({ message: `${partName}: Quantity must be a whole number for pieces` });
        }
        if (quantity < 1) {
          return res.status(400).json({ message: `${partName}: Quantity must be at least 1 for pieces` });
        }
      } else if (measurement === "liter") {
        if (quantity < 0.01) {
          return res.status(400).json({ message: `${partName}: Quantity must be at least 0.01 for liters` });
        }
      }

      const totalPrice = quantity * unitPrice;

      // Try to find spare part in inventory by name (not code)
      let sparePartId = null;
      if (partName) {
        const sparePart = await SparePart.findOne({ name: partName.trim() });
        if (sparePart) {
          // Check if enough quantity is available
          if (sparePart.quantity < quantity) {
            return res.status(400).json({ 
              message: `Insufficient stock for ${partName}. Available: ${sparePart.quantity}, Requested: ${quantity}` 
            });
          }
          sparePartId = sparePart._id;
          
          // Note: Inventory will be deducted by the pre-save middleware in the LoanSparePart model
        }
      }

      // Add item to loan
      loanItems.push({
        sparePartId,
        partName: partName.trim(),
        partCode: partCode ? partCode.trim() : "",
        measurement,
        quantity,
        unitPrice,
        totalPrice,
        description: description ? description.trim() : "",
        unit: measurement === "liter" ? "L" : "pcs"
      });

      grandTotal += totalPrice;
    }

    // Round grand total to 2 decimal places
    grandTotal = Math.round(grandTotal * 100) / 100;

    // Create the loan - inventory will be automatically deducted by pre-save middleware
    const loan = await LoanSparePart.create({
      borrowerName: borrowerName.trim(),
      borrowerPhone: borrowerPhone ? borrowerPhone.trim() : "",
      borrowerType,
      expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : undefined,
      note: note ? note.trim() : "",
      items: loanItems,
      grandTotal,
      remainingAmount: grandTotal,
      status: "active",
      createdBy: req.user ? req.user.name : "System"
    });

    res.status(201).json({ 
      message: "Loan created successfully", 
      loan: {
        _id: loan._id,
        borrowerName: loan.borrowerName,
        borrowerPhone: loan.borrowerPhone,
        borrowerType: loan.borrowerType,
        grandTotal: loan.grandTotal,
        remainingAmount: loan.remainingAmount,
        status: loan.status,
        items: loan.items.map(item => ({
          partName: item.partName,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice
        }))
      }
    });
  } catch (err) {
    console.error("Create loan error:", err);
    
    // Handle specific error types
    if (err.message.includes("Insufficient quantity")) {
      return res.status(400).json({ message: err.message });
    }
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    
    res.status(500).json({ 
      message: "Failed to create loan", 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

// Update (Edit) a loan
exports.updateLoan = async (req, res) => {
  try {
    const { id } = req.params;
    const { borrowerName, borrowerPhone, borrowerType, expectedReturnDate, note, items } = req.body;

    const loan = await LoanSparePart.findById(id);
    if (!loan) return res.status(404).json({ message: "Loan not found" });
    if (loan.returned) return res.status(400).json({ message: "Returned loan cannot be edited" });

    // 🔄 Restore previous stock
    for (const item of loan.items) {
      if (item.sparePartId) {
        const sparePart = await SparePart.findById(item.sparePartId);
        if (sparePart) {
          sparePart.quantity += item.quantity;
          await sparePart.save();
        }
      }
    }

    let newItems = [];
    let grandTotal = 0;

    // 🔁 Deduct new stock
    for (const item of items) {
      const { partName, partCode, quantity, unitPrice } = item;
      if (!partName || quantity <= 0 || unitPrice < 0) {
        return res.status(400).json({ message: "Invalid item data" });
      }

      // Find spare part by name
      let sparePart = null;
      if (partName) {
        sparePart = await SparePart.findOne({ name: partName.trim() });
        if (sparePart) {
          if (sparePart.quantity < quantity) {
            return res.status(400).json({ message: `Insufficient stock for ${partName}` });
          }
          // Don't deduct here - will be done by middleware
        }
      }

      const totalPrice = quantity * unitPrice;
      newItems.push({ 
        sparePartId: sparePart ? sparePart._id : null,
        partName, 
        partCode: partCode || "", 
        quantity, 
        unitPrice, 
        totalPrice,
        measurement: item.measurement || "piece",
        unit: item.measurement === "liter" ? "L" : "pcs"
      });
      grandTotal += totalPrice;
    }

    // 📝 Update fields
    loan.borrowerName = borrowerName;
    loan.borrowerPhone = borrowerPhone;
    loan.borrowerType = borrowerType;
    loan.expectedReturnDate = expectedReturnDate;
    loan.note = note;
    loan.items = newItems;
    loan.grandTotal = grandTotal;
    loan.remainingAmount = grandTotal - (loan.returnedAmount || 0);

    await loan.save();

    res.json({ message: "Loan updated successfully", loan });
  } catch (err) {
    console.error("Update loan error:", err);
    res.status(500).json({ message: err.message });
  }
};

// GET all loans
exports.getAllLoans = async (req, res) => {
  try {
    const loans = await LoanSparePart.find().sort({ createdAt: -1 });
    res.json(loans);
  } catch (error) {
    console.error("Get all loans error:", error);
    res.status(500).json({ message: error.message });
  }
};

// GET loan by ID
exports.getLoanById = async (req, res) => {
  try {
    const loan = await LoanSparePart.findById(req.params.id);
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }
    res.json(loan);
  } catch (error) {
    console.error("Get loan by ID error:", error);
    res.status(500).json({ message: error.message });
  }
};

// GET returned loans
exports.getReturnedLoans = async (req, res) => {
  try {
    const loans = await LoanSparePart.find({ returned: true }).sort({ createdAt: -1 });
    res.json(loans);
  } catch (error) {
    console.error("Get returned loans error:", error);
    res.status(500).json({ message: error.message });
  }
};

// GET active loans
exports.getActiveLoans = async (req, res) => {
  try {
    const loans = await LoanSparePart.find({ returned: false }).sort({ createdAt: -1 });
    res.json(loans);
  } catch (error) {
    console.error("Get active loans error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Return loan (partial or complete)
exports.returnLoan = async (req, res) => {
  try {
    const { amount } = req.body;
    const loan = await LoanSparePart.findById(req.params.id);
    
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }
    
    if (loan.returned) {
      return res.status(400).json({ message: 'Loan already returned' });
    }
    
    // Update returned amount
    loan.returnedAmount = (loan.returnedAmount || 0) + Number(amount);
    loan.lastReturnDate = new Date();
    
    // Check if fully returned
    if (loan.returnedAmount >= loan.grandTotal) {
      loan.returned = true;
      loan.returnDate = new Date();
      loan.status = "completed";
      
      // Restore stock when loan is fully returned
      for (const item of loan.items) {
        if (item.sparePartId) {
          const sparePart = await SparePart.findById(item.sparePartId);
          if (sparePart) {
            sparePart.quantity += item.quantity;
            await sparePart.save();
          }
        }
      }
    }
    
    loan.remainingAmount = loan.grandTotal - loan.returnedAmount;
    await loan.save();
    
    res.json({ 
      message: 'Return processed successfully',
      loan,
      isFullyReturned: loan.returned
    });
  } catch (error) {
    console.error("Return loan error:", error);
    res.status(400).json({ message: error.message });
  }
};

// Complete return
exports.completeReturn = async (req, res) => {
  try {
    const loan = await LoanSparePart.findById(req.params.id);
    
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }
    
    if (loan.returned) {
      return res.status(400).json({ message: 'Loan already returned' });
    }
    
    loan.returned = true;
    loan.returnDate = new Date();
    loan.returnedAmount = loan.grandTotal;
    loan.remainingAmount = 0;
    loan.status = "completed";
    
    // Restore stock when loan is fully returned
    for (const item of loan.items) {
      if (item.sparePartId) {
        const sparePart = await SparePart.findById(item.sparePartId);
        if (sparePart) {
          sparePart.quantity += item.quantity;
          await sparePart.save();
        }
      }
    }
    
    await loan.save();
    
    res.json({ 
      message: 'Loan marked as fully returned', 
      loan 
    });
  } catch (error) {
    console.error("Complete return error:", error);
    res.status(400).json({ message: error.message });
  }
};

// DELETE loan (move to recycle bin) - FIXED: Changed Loan to LoanSparePart
exports.deleteLoan = async (req, res) => {
  try {
    const loan = await LoanSparePart.findById(req.params.id); // Changed from Loan to LoanSparePart
    
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    // Save to recycle bin
    const deletedLoan = new DeletedLoan({
      originalId: loan._id.toString(),
      loanData: loan.toObject(),
      deletedBy: req.user?.username || 'System'
    });

    await deletedLoan.save();

    // Delete from active loans
    await LoanSparePart.findByIdAndDelete(req.params.id); // Changed from Loan to LoanSparePart

    res.json({ 
      message: 'Loan moved to recycle bin',
      deletedLoanId: deletedLoan._id,
      restoreUntil: deletedLoan.restoreUntil
    });
  } catch (error) {
    console.error("Delete loan error:", error);
    res.status(500).json({ message: error.message });
  }
};

// RESTORE from recycle bin - FIXED: Changed Loan to LoanSparePart
exports.restoreLoan = async (req, res) => {
  try {
    const deletedLoan = await DeletedLoan.findById(req.params.id);
    
    if (!deletedLoan) {
      return res.status(404).json({ message: 'Deleted loan not found' });
    }

    if (deletedLoan.isRestored) {
      return res.status(400).json({ message: 'Loan already restored' });
    }

    if (new Date() > deletedLoan.restoreUntil) {
      return res.status(400).json({ message: 'Cannot restore: Time limit expired' });
    }

    // Restore the loan - Changed from Loan to LoanSparePart
    const restoredLoan = new LoanSparePart(deletedLoan.loanData);
    await restoredLoan.save();

    // Mark as restored
    deletedLoan.isRestored = true;
    await deletedLoan.save();

    res.json({ 
      message: 'Loan restored successfully',
      loan: restoredLoan 
    });
  } catch (error) {
    console.error("Restore loan error:", error);
    res.status(500).json({ message: error.message });
  }
};

// GET recycle bin items
exports.getRecycleBin = async (req, res) => {
  try {
    const deletedLoans = await DeletedLoan.find({ 
      isRestored: false
    }).sort({ deletedAt: -1 });

    res.json(deletedLoans);
  } catch (error) {
    console.error("Get recycle bin error:", error);
    res.status(500).json({ message: error.message });
  }
};

// PERMANENT DELETE from recycle bin
exports.permanentDelete = async (req, res) => {
  try {
    const deletedLoan = await DeletedLoan.findById(req.params.id);
    
    if (!deletedLoan) {
      return res.status(404).json({ message: 'Deleted loan not found' });
    }

    if (deletedLoan.isRestored) {
      return res.status(400).json({ message: 'Cannot delete restored loan' });
    }

    await DeletedLoan.findByIdAndDelete(req.params.id);
    res.json({ message: 'Permanently deleted from recycle bin' });
  } catch (error) {
    console.error("Permanent delete error:", error);
    res.status(500).json({ message: error.message });
  }
};

// CLEANUP expired recycle bin items
exports.cleanupRecycleBin = async (req, res) => {
  try {
    const result = await DeletedLoan.deleteMany({
      restoreUntil: { $lt: new Date() },
      isRestored: false
    });

    res.json({ 
      message: `Cleaned up ${result.deletedCount} expired items`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error("Cleanup recycle bin error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Delete item from loan
exports.deleteItem = async (req, res) => {
  try {
    const { loanId, itemId } = req.params;
    
    const loan = await LoanSparePart.findById(loanId);
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }
    
    // Find the item to be deleted
    const itemToDelete = loan.items.find(item => 
      item._id.toString() === itemId
    );
    
    if (!itemToDelete) {
      return res.status(404).json({ message: 'Item not found in loan' });
    }
    
    // Restore stock if item has sparePartId
    if (itemToDelete.sparePartId) {
      const sparePart = await SparePart.findById(itemToDelete.sparePartId);
      if (sparePart) {
        sparePart.quantity += itemToDelete.quantity;
        await sparePart.save();
      }
    }
    
    // Remove item from array
    loan.items = loan.items.filter(item => 
      item._id.toString() !== itemId
    );
    
    // Recalculate total
    loan.grandTotal = loan.items.reduce((sum, item) => 
      sum + (item.quantity * item.unitPrice), 0
    );
    
    // Recalculate remaining amount
    loan.remainingAmount = loan.grandTotal - (loan.returnedAmount || 0);
    
    await loan.save();
    
    res.json({ 
      message: 'Item deleted successfully', 
      loan,
      deletedItem: itemToDelete
    });
  } catch (error) {
    console.error("Delete item error:", error);
    res.status(500).json({ message: error.message });
  }
};