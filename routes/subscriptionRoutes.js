const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const Notification = require("../models/Notification");
const ParentSubscription = require("../models/ParentSubscription");

// 🟣 Aile Yönetim Planı satın alma (eş davet opsiyonlu)
router.post("/purchase", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { inviteId } = req.body; // eş davet kodu opsiyonel
    const planPrice = 1000;
    const planDuration = 365 * 24 * 60 * 60 * 1000; // 1 yıl ms

    // 1️⃣ Kullanıcıyı getir
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    // 2️⃣ Zaten aktif abonelik varsa engelle
    if (user.subscriptionActive && user.subscriptionExpiresAt > new Date()) {
      return res.status(400).json({ success: false, message: "Zaten aktif bir aboneliğiniz bulunuyor." });
    }

    // 3️⃣ Cüzdan kontrolü
    const wallet = await Wallet.findOne({ userId });
    if (!wallet || wallet.balance < planPrice) {
      return res.status(400).json({ success: false, message: "Yetersiz bakiye. Lütfen para yükleyin." });
    }

    // 4️⃣ Cüzdandan düş
    wallet.balance -= planPrice;
    await wallet.save();

    // 5️⃣ ParentSubscription oluştur
    const startDate = new Date();
    const endDate = new Date(Date.now() + planDuration);

    const subscription = new ParentSubscription({
      userId,
      spouseId: null,
      children: [],
      startDate,
      endDate,
      isActive: true,
      price: planPrice,
      status: "active",
    });
    await subscription.save();

    // 6️⃣ Kullanıcıyı ebeveyn rolüne geçir
    user.role = "parent";
    user.subscriptionActive = true;
    user.subscriptionExpiresAt = endDate;
    user.subscriptionId = subscription._id;
    await user.save();

    // 7️⃣ Eş daveti varsa işle
    let spouse = null;
    if (inviteId) {
      spouse = await User.findOne({ inviteID: inviteId });
      if (!spouse) {
        return res.status(404).json({
          success: false,
          message: "Bu davet koduna sahip kullanıcı bulunamadı.",
        });
      }

      // Eğer zaten bağlıysa reddet
      if (spouse.wife_husband || user.wife_husband) {
        return res.status(400).json({
          success: false,
          message: "Bu kullanıcı zaten bir eşe bağlı.",
        });
      }

      // Eşlik oluştur
      spouse.role = "parent";
      spouse.wife_husband = user._id;
      spouse.subscriptionActive = true;
      spouse.subscriptionExpiresAt = endDate;
      spouse.subscriptionId = subscription._id;
      await spouse.save();

      user.wife_husband = spouse._id;
      await user.save();

      subscription.spouseId = spouse._id;
      await subscription.save();

      // Bildirimler
      await Notification.create([
        {
          userId,
          type: "subscription_purchased",
          description: `Aile Yönetim Planı satın alındı. ${spouse.name || "Eş"} davet edildi.`,
          status: "success",
        },
        {
          userId: spouse._id,
          type: "spouse_invited",
          description: `${user.name || "Eşiniz"} sizi Aile Yönetim Planına davet etti.`,
          status: "pending",
        },
      ]);
    } else {
      // 8️⃣ Eş daveti yoksa yalnız satın alma bildirimi
      await Notification.create({
        userId,
        type: "subscription_purchased",
        description: "Aile Yönetim Planı satın alındı (eş daveti olmadan).",
        status: "success",
      });
    }

    // 9️⃣ Yanıt
    res.json({
      success: true,
      message: spouse
        ? `Aile Yönetim Planı alındı ve ${spouse.name || "Eş"} davet edildi.`
        : "Aile Yönetim Planı başarıyla satın alındı.",
      role: "parent",
      walletBalance: wallet.balance,
      subscription: {
        id: subscription._id,
        expiresAt: endDate,
        spouseId: subscription.spouseId,
        isActive: true,
      },
    });
  } catch (err) {
    console.error("❌ Subscription purchase error:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası." });
  }
});

module.exports = router;
