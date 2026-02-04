const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const loanController = require("../controllers/loanController");

// ==================== MAIN LOAN ROUTES ====================
router.post("/", loanController.createLoan);
router.get("/", loanController.getAllLoans);
router.get("/returned", auth, loanController.getReturnedLoans);
router.get("/active", auth, loanController.getActiveLoans);
router.get("/:id", auth, loanController.getLoanById);
router.put("/:id", loanController.updateLoan);

// ==================== LOAN RETURN ROUTES ====================
router.put("/:id/return", loanController.returnLoan);  // Partial return
router.put("/return/:id", loanController.returnLoan);  // Alternative
router.put("/:id/complete-return", loanController.completeReturn); // Complete return

// ==================== RECYCLE BIN ROUTES ====================
// DELETE loan (moves to recycle bin)
router.delete("/:id", loanController.deleteLoan);

// RESTORE from recycle bin
router.post("/:id/restore", loanController.restoreLoan);

// GET recycle bin items
router.get("/recycle-bin/all", loanController.getRecycleBin);

// PERMANENT DELETE from recycle bin
router.delete("/recycle-bin/:id", loanController.permanentDelete);

// CLEANUP expired recycle bin items
router.post("/recycle-bin/cleanup", loanController.cleanupRecycleBin);

// ==================== ITEM MANAGEMENT ROUTES ====================
// Delete item from loan
router.delete("/:loanId/items/:itemId", loanController.deleteItem);

module.exports = router;