const mongoose = require("mongoose");

// Each borrowed item - with reference to spare part inventory
const loanItemSchema = new mongoose.Schema({
  // Reference to SparePart inventory (optional - for tracking stock)
  sparePartId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SparePart"
  },
  
  partName: { 
    type: String, 
    required: true,
    trim: true
  },
  
  partCode: { 
    type: String,
    trim: true
  },
  
  measurement: {
    type: String,
    enum: ["piece", "liter"],
    default: "piece"
  },
  
  unit: {
    type: String,
    enum: ["pcs", "L"],
    default: function() {
      return this.measurement === "liter" ? "L" : "pcs";
    }
  },
  
  quantity: { 
    type: Number, 
    required: true,
    min: 0.01,
    validate: {
      validator: function(value) {
        if (this.measurement === "piece") {
          return Number.isInteger(value) && value >= 1;
        }
        return value > 0;
      },
      message: props => `Quantity must be a whole number for pieces`
    }
  },
  
  unitPrice: { 
    type: Number, 
    required: true,
    min: 0
  },
  
  totalPrice: { 
    type: Number, 
    required: true,
    min: 0
  },
  
  description: {
    type: String,
    trim: true
  }
}, { _id: true });

// Pre-save middleware for items
loanItemSchema.pre("save", function(next) {
  // Calculate total price
  this.totalPrice = this.quantity * this.unitPrice;
  
  // Set unit based on measurement
  this.unit = this.measurement === "liter" ? "L" : "pcs";
  
  // Round to 2 decimal places for currency
  this.totalPrice = Math.round(this.totalPrice * 100) / 100;
  this.unitPrice = Math.round(this.unitPrice * 100) / 100;
  
  next();
});

// Main loan schema
const loanSchema = new mongoose.Schema({
  items: {
    type: [loanItemSchema],
    required: true,
    validate: {
      validator: function(items) {
        return items && items.length > 0;
      },
      message: "At least one item is required"
    }
  },

  grandTotal: {
    type: Number,
    required: true,
    min: 0
  },

  borrowerName: {
    type: String,
    required: true,
    trim: true
  },

  borrowerPhone: {
    type: String,
    trim: true
  },

  borrowerType: {
    type: String,
    enum: ["Mechanic", "Customer", "Supplier", "Other"],
    default: "Mechanic"
  },

  expectedReturnDate: {
    type: Date,
    validate: {
      validator: function(date) {
        if (!date) return true;
        return date >= new Date().setHours(0, 0, 0, 0);
      },
      message: "Expected return date cannot be in the past"
    }
  },

  returned: {
    type: Boolean,
    default: false
  },

  returnDate: {
    type: Date
  },

  lastReturnDate: {
    type: Date
  },

  returnedAmount: {
    type: Number,
    default: 0,
    min: 0
  },

  remainingAmount: {
    type: Number,
    default: function () {
      return this.grandTotal;
    },
    min: 0
  },

  note: {
    type: String,
    trim: true
  },

  status: {
    type: String,
    enum: ["active", "partial", "overdue", "returned"],
    default: "active"
  },

  createdBy: {
    type: String,
    trim: true
  }

}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for checking if overdue
loanSchema.virtual("isOverdue").get(function() {
  if (this.returned || !this.expectedReturnDate) return false;
  return new Date() > this.expectedReturnDate;
});

// Virtual for days overdue
loanSchema.virtual("daysOverdue").get(function() {
  if (!this.isOverdue) return 0;
  const today = new Date();
  const diffTime = Math.abs(today - this.expectedReturnDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware
loanSchema.pre("save", function(next) {
  // Calculate grand total from items
  if (this.items && this.items.length > 0) {
    this.grandTotal = this.items.reduce((sum, item) => {
      return sum + (item.totalPrice || 0);
    }, 0);
    this.grandTotal = Math.round(this.grandTotal * 100) / 100;
  }

  // Calculate remaining amount
  this.remainingAmount = Math.max(0, this.grandTotal - this.returnedAmount);
  
  // Update status
  if (this.returned) {
    this.status = "returned";
  } else if (this.returnedAmount > 0) {
    this.status = "partial";
  } else if (this.isOverdue) {
    this.status = "overdue";
  } else {
    this.status = "active";
  }

  next();
});

// Pre-save middleware for new loans - update inventory
loanSchema.pre("save", async function(next) {
  // Only run for new documents (not updates)
  if (this.isNew) {
    try {
      const SparePart = mongoose.model("SparePart");
      
      // Update inventory for each item
      for (const item of this.items) {
        if (item.sparePartId) {
          // Find the spare part in inventory
          const sparePart = await SparePart.findById(item.sparePartId);
          
          if (sparePart) {
            // Check if enough quantity is available
            if (sparePart.quantity < item.quantity) {
              throw new Error(`Insufficient quantity for ${item.partName}. Available: ${sparePart.quantity}, Requested: ${item.quantity}`);
            }
            
            // Reduce inventory quantity
            sparePart.quantity -= item.quantity;
            await sparePart.save();
          }
        }
      }
    } catch (error) {
      return next(error);
    }
  }
  
  next();
});

// Post-remove middleware - restore inventory when loan is deleted
loanSchema.post("findOneAndDelete", async function(doc) {
  if (doc) {
    const SparePart = mongoose.model("SparePart");
    
    // Restore inventory for each item
    for (const item of doc.items) {
      if (item.sparePartId && !doc.returned) {
        const sparePart = await SparePart.findById(item.sparePartId);
        
        if (sparePart) {
          // Add back the quantity
          sparePart.quantity += item.quantity;
          await sparePart.save();
        }
      }
    }
  }
});

// Static method for partial return
loanSchema.statics.addPartialReturn = async function(loanId, amount, returnDate = new Date()) {
  const loan = await this.findById(loanId);
  if (!loan) throw new Error("Loan not found");
  if (loan.returned) throw new Error("Loan already fully returned");
  
  loan.returnedAmount = (loan.returnedAmount || 0) + amount;
  loan.lastReturnDate = returnDate;
  
  if (loan.returnedAmount >= loan.grandTotal) {
    loan.returned = true;
    loan.returnDate = returnDate;
    loan.remainingAmount = 0;
  } else {
    loan.remainingAmount = loan.grandTotal - loan.returnedAmount;
  }
  
  return await loan.save();
};

// Static method to mark as fully returned - restore inventory
loanSchema.statics.markAsReturned = async function(loanId, returnDate = new Date()) {
  const loan = await this.findById(loanId);
  if (!loan) throw new Error("Loan not found");
  
  const SparePart = mongoose.model("SparePart");
  
  // Restore inventory for each item
  for (const item of loan.items) {
    if (item.sparePartId) {
      const sparePart = await SparePart.findById(item.sparePartId);
      
      if (sparePart) {
        // Add back the quantity when returned
        sparePart.quantity += item.quantity;
        await sparePart.save();
      }
    }
  }
  
  loan.returned = true;
  loan.returnDate = returnDate;
  loan.returnedAmount = loan.grandTotal;
  loan.remainingAmount = 0;
  loan.status = "returned";
  
  return await loan.save();
};

// Static method to remove an item - restore inventory for that item
loanSchema.statics.removeItem = async function(loanId, itemId) {
  const loan = await this.findById(loanId);
  if (!loan) throw new Error("Loan not found");
  if (loan.returned) throw new Error("Cannot modify returned loan");
  
  // Find the item to remove
  const itemToRemove = loan.items.find(item => item._id.toString() === itemId);
  if (!itemToRemove) {
    throw new Error("Item not found in loan");
  }
  
  // Restore inventory for this item
  if (itemToRemove.sparePartId) {
    const SparePart = mongoose.model("SparePart");
    const sparePart = await SparePart.findById(itemToRemove.sparePartId);
    
    if (sparePart) {
      sparePart.quantity += itemToRemove.quantity;
      await sparePart.save();
    }
  }
  
  // Remove the item from loan
  loan.items = loan.items.filter(item => item._id.toString() !== itemId);
  
  // Recalculate totals
  loan.grandTotal = loan.items.reduce((sum, item) => sum + item.totalPrice, 0);
  loan.remainingAmount = Math.max(0, loan.grandTotal - loan.returnedAmount);
  
  return await loan.save();
};

// Static method to update a loan - handle inventory changes
loanSchema.statics.updateLoan = async function(loanId, updateData) {
  const loan = await this.findById(loanId);
  if (!loan) throw new Error("Loan not found");
  if (loan.returned) throw new Error("Cannot modify returned loan");
  
  const SparePart = mongoose.model("SparePart");
  
  // Handle item updates
  if (updateData.items) {
    // Restore inventory for old items
    for (const oldItem of loan.items) {
      if (oldItem.sparePartId) {
        const sparePart = await SparePart.findById(oldItem.sparePartId);
        if (sparePart) {
          sparePart.quantity += oldItem.quantity;
          await sparePart.save();
        }
      }
    }
    
    // Deduct inventory for new items
    for (const newItem of updateData.items) {
      if (newItem.sparePartId) {
        const sparePart = await SparePart.findById(newItem.sparePartId);
        if (sparePart) {
          if (sparePart.quantity < newItem.quantity) {
            throw new Error(`Insufficient quantity for ${newItem.partName}. Available: ${sparePart.quantity}, Requested: ${newItem.quantity}`);
          }
          sparePart.quantity -= newItem.quantity;
          await sparePart.save();
        }
      }
    }
  }
  
  // Update loan with new data
  Object.assign(loan, updateData);
  return await loan.save();
};

// Indexes for better query performance
loanSchema.index({ borrowerName: 1 });
loanSchema.index({ borrowerPhone: 1 });
loanSchema.index({ status: 1 });
loanSchema.index({ expectedReturnDate: 1 });
loanSchema.index({ createdAt: -1 });
loanSchema.index({ returned: 1, expectedReturnDate: 1 });

module.exports = mongoose.model("LoanSparePart", loanSchema);