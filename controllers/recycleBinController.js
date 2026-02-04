const DeletedLoan = require('../models/DeletedLoan');
const Loan = require('../models/Loan');

// GET recycle bin items
exports.getRecycleBin = async (req, res) => {
  try {
    const deletedLoans = await DeletedLoan.find({ 
      isRestored: false,
      restoreUntil: { $gt: new Date() }
    }).sort({ deletedAt: -1 });

    res.json(deletedLoans);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// RESTORE from recycle bin
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

    // Restore the loan
    const restoredLoan = new Loan(deletedLoan.loanData);
    await restoredLoan.save();

    // Mark as restored
    deletedLoan.isRestored = true;
    await deletedLoan.save();

    res.json({ 
      message: 'Loan restored successfully',
      loan: restoredLoan 
    });
  } catch (error) {
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
    res.status(500).json({ message: error.message });
  }
};