const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");
const authMiddleware = require("../middleware/authMiddleware");

// ✅ Kullanıcının tüm işlemlerini getir
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const transactions = await Transaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({ success: true, transactions });
  } catch (err) {
    console.error("❌ Transaction get error:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

module.exports = router;
