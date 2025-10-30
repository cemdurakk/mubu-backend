const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const Notification = require("../models/Notification");

// 🟣 Aile Yönetim Planı satın alma
router.post("/purchase", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const planPrice = 1000; // ₺1000
    const planDuration = 365; // 1 yıl (gün)

    // 1️⃣ Kullanıcıyı getir
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    // 2️⃣ Zaten aktif aboneliği varsa engelle
    if (user.subscriptionActive && user.subscriptionExpiresAt && user.subscriptionExpiresAt > new Date()) {
      return res.status(400).json({ success: false, message: "Zaten aktif bir aboneliğiniz bulunuyor." });
    }

    // 3️⃣ Kullanıcının cüzdanını bul
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(404).json({ success: false, message: "Cüzdan bulunamadı" });
    }

    // 4️⃣ Bakiye kontrolü
    if (wallet.balance < planPrice) {
      return res.status(400).json({ success: false, message: "Yetersiz bakiye. Lütfen para yükleyin." });
    }

    // 5️⃣ Cüzdandan 1000 TL düş
    wallet.balance -= planPrice;
    await wallet.save();

    // 6️⃣ Kullanıcıyı ebeveyn rolüne geçir
    user.role = "parent";
    user.subscriptionActive = true;
    user.subscriptionExpiresAt = new Date(Date.now() + planDuration * 24 * 60 * 60 * 1000); // 1 yıl sonrası
    user.parentId = user._id; // kendisini parentId olarak ata
    await user.save();

    // 7️⃣ Bildirim oluştur
    const notification = new Notification({
      userId,
      type: "subscription_purchase",
      amount: planPrice,
      description: "Aile Yönetim Planı (1 Yıl) satın alındı",
      status: "completed",
    });
    await notification.save();

    res.json({
      success: true,
      message: "Aile Yönetim Planı başarıyla satın alındı.",
      newRole: "parent",
      walletBalance: wallet.balance,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
    });
  } catch (err) {
    console.error("❌ Subscription purchase error:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası." });
  }
});

module.exports = router;
