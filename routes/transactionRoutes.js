const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");
const authMiddleware = require("../middleware/authMiddleware");

// ✅ Kullanıcının TÜM kumbara işlemlerini getir
router.get("/transactions", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const transactions = await Transaction.find({ userId })
      .sort({ createdAt: -1 }) // en yeni en üstte
      .lean();

    res.status(200).json({
      success: true,
      transactions,
    });
  } catch (err) {
    console.error("❌ Transaction fetch error:", err);
    res.status(500).json({
      success: false,
      message: "Sunucu hatası",
    });
  }
});

module.exports = router;
