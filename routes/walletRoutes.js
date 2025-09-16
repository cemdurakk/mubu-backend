// C:\Users\yasar\mubu-backend\routes\walletRoutes.js

const express = require("express");
const router = express.Router();
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction"); // 📌 Transaction modelini dahil et
const authMiddleware = require("../middleware/authMiddleware");

// ✅ Kullanıcının cüzdanını getir
router.get("/:userId", authMiddleware, async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.params.userId });

    if (!wallet) {
      return res.status(404).json({ success: false, message: "Cüzdan bulunamadı" });
    }

    res.json({ success: true, wallet });
  } catch (err) {
    console.error("❌ Wallet get error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ Yeni cüzdan oluştur
router.post("/create", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.body;

    let wallet = await Wallet.findOne({ userId });
    if (wallet) {
      return res.status(400).json({ success: false, message: "Cüzdan zaten mevcut" });
    }

    wallet = new Wallet({ userId, balance: 0 });
    await wallet.save();

    res.json({ success: true, message: "Cüzdan oluşturuldu", wallet });
  } catch (err) {
    console.error("❌ Wallet create error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ Para yükleme (fake deposit)
router.post("/deposit", authMiddleware, async (req, res) => {
  try {
    const { userId, amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Geçerli bir tutar giriniz" });
    }

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(404).json({ success: false, message: "Cüzdan bulunamadı" });
    }

    // Bakiye ekle
    wallet.balance += amount;

    // Transaction oluştur
    const transaction = new Transaction({
      type: "deposit",
      amount,
      from: wallet._id,
    });

    await transaction.save();

    // Wallet'a ilişkilendir
    wallet.transactions.push(transaction._id);
    await wallet.save();

    res.json({
      success: true,
      message: `${amount} TL cüzdana yüklendi`,
      wallet,
      transaction,
    });
  } catch (err) {
    console.error("❌ Deposit error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ Cüzdan güncelle (manuel update için, gerekirse)
router.post("/update", authMiddleware, async (req, res) => {
  try {
    const { userId, amount } = req.body;

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(404).json({ success: false, message: "Cüzdan bulunamadı" });
    }

    wallet.balance += amount;
    await wallet.save();

    res.json({ success: true, message: "Cüzdan güncellendi", wallet });
  } catch (err) {
    console.error("❌ Wallet update error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ Para çekme (fake withdraw)
router.post("/withdraw", authMiddleware, async (req, res) => {
  try {
    const { userId, amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Geçerli bir tutar giriniz" });
    }

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(404).json({ success: false, message: "Cüzdan bulunamadı" });
    }

    // Bakiye kontrolü
    if (wallet.balance < amount) {
      return res.status(400).json({ success: false, message: "Yetersiz bakiye" });
    }

    // Bakiyeden düş
    wallet.balance -= amount;

    // Transaction oluştur
    const transaction = new Transaction({
      type: "withdraw",
      amount,
      from: wallet._id,
    });

    await transaction.save();

    // Wallet'a ilişkilendir
    wallet.transactions.push(transaction._id);
    await wallet.save();

    res.json({
      success: true,
      message: `${amount} TL cüzdandan çekildi`,
      wallet,
      transaction,
    });
  } catch (err) {
    console.error("❌ Withdraw error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


module.exports = router;
