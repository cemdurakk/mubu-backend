// C:\Users\yasar\mubu-backend\routes\transactionRoutes.js

const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");
const authMiddleware = require("../middleware/authMiddleware");

// ✅ Kullanıcının tüm işlemlerini getir
router.get("/:userId", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    // Kullanıcının tüm işlemlerini bul, tarihe göre sırala (son işlem en üstte)
    const transactions = await Transaction.find({ userId }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: transactions.length,
      transactions,
    });
  } catch (err) {
    console.error("❌ Transaction get error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
