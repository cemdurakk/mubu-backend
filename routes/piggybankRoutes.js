const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const PiggyBank = require("../models/PiggyBank");
const SubWallet = require("../models/SubWallet");


// ✅ Yeni kumbara oluştur
router.post("/create", authMiddleware, async (req, res) => {
  try {
    const { type, name, targetAmount, category, color } = req.body;
    const userId = req.user.userId;

    if (!type) {
      return res.status(400).json({ success: false, error: "Kumbara türü (type) gerekli" });
    }

    // Kullanıcının subWallet’ını bul/oluştur
    let subWallet = await SubWallet.findOne({ userId, type });
    if (!subWallet) {
      subWallet = new SubWallet({
        userId,
        type,
        participants: [userId],
        piggyBanks: [],
      });
      await subWallet.save();
    }

    // Yeni kumbara oluştur (parayı direkt içine atıyoruz)
    const piggyBank = new PiggyBank({
      subWalletId: subWallet._id,
      name,
      targetAmount,             // kullanıcı belirlediği miktar
      currentAmount: targetAmount, // ✅ direkt içine eklendi
      category,
      color,
      participants: [userId],
    });
    await piggyBank.save();

    // SubWallet’a ekle
    subWallet.piggyBanks.push(piggyBank._id);
    await subWallet.save();

    return res.status(201).json({
      success: true,
      message: "Kumbara başarıyla oluşturuldu",
      piggyBank,
    });
  } catch (err) {
    console.error("❌ Kumbara oluşturma hatası:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});



// ✅ Kullanıcının tüm kumbaralarını getir
router.get("/all", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const subWallets = await SubWallet.find({ participants: userId }).populate("piggyBanks");

    let piggyBanks = [];
    let usedBalance = 0;

    subWallets.forEach(sw => {
      sw.piggyBanks.forEach(pb => {
        piggyBanks.push(pb);
        usedBalance += pb.currentAmount || 0; // 🔹 ayrılmış para
      });
    });

    return res.status(200).json({
      success: true,
      piggyBanks,
      usedBalance, // 🔹 toplam ayrılan para
    });
  } catch (err) {
    console.error("❌ Tüm kumbaraları listeleme hatası:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});




// ✅ Belirli bir SubWallet’ın kumbaralarını getir
router.get("/:subWalletId", authMiddleware, async (req, res) => {
  try {
    const { subWalletId } = req.params;

    const piggyBanks = await PiggyBank.find({ subWalletId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      piggyBanks,
    });
  } catch (err) {
    console.error("❌ Belirli subWallet kumbaraları listeleme hatası:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});


module.exports = router;
