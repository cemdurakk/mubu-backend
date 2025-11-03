const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const Notification = require("../models/Notification");
const authMiddleware = require("../middleware/authMiddleware");

/**
 * 🎯 Harçlık gönderme endpointi
 * POST /api/allowance/send
 * body: { childId, amount }
 */
router.post("/send", authMiddleware, async (req, res) => {
  try {
    const parentId = req.user.userId;
    const { childId, amount } = req.body;

    if (!childId || !amount)
      return res.status(400).json({
        success: false,
        message: "childId ve amount alanları zorunludur.",
      });

    const parent = await User.findById(parentId);
    if (!parent || parent.role !== "parent")
      return res.status(403).json({
        success: false,
        message: "Sadece ebeveyn kullanıcılar harçlık gönderebilir.",
      });

    const child = await User.findById(childId);
    if (!child || child.role !== "child")
      return res.status(404).json({
        success: false,
        message: "Çocuk bulunamadı.",
      });

    const parentWallet = await Wallet.findOne({ userId: parentId });
    const childWallet = await Wallet.findOne({ userId: childId });

    if (!parentWallet || !childWallet)
      return res.status(404).json({
        success: false,
        message: "Cüzdan bilgileri bulunamadı.",
      });

    const sendAmount = Number(amount);
    if (sendAmount <= 0)
      return res.status(400).json({
        success: false,
        message: "Tutar sıfırdan büyük olmalıdır.",
      });

    if (parentWallet.balance < sendAmount)
      return res.status(400).json({
        success: false,
        message: "Yetersiz bakiye.",
      });

    // 🟣 Transfer işlemi
    parentWallet.balance -= sendAmount;
    childWallet.balance += sendAmount;

    await parentWallet.save();
    await childWallet.save();

    // 🔔 Bildirim oluştur (ebeveyn)
    await Notification.create({
      userId: parentId,
      type: "allowance_sent",
      amount: sendAmount,
      description: `${child.name} isimli çocuğa ₺${sendAmount} harçlık gönderildi.`,
      status: "success",
      createdAt: new Date(),
    });

    // 🔔 Bildirim oluştur (çocuk)
    await Notification.create({
      userId: childId,
      type: "allowance_received",
      amount: sendAmount,
      description: `${parent.name} tarafından ₺${sendAmount} harçlık gönderildi.`,
      status: "success",
      createdAt: new Date(),
    });

    res.json({
      success: true,
      message: `${child.name} isimli çocuğa ₺${sendAmount} harçlık gönderildi.`,
      newParentBalance: parentWallet.balance,
    });
  } catch (err) {
    console.error("❌ Harçlık gönderim hatası:", err);
    res.status(500).json({
      success: false,
      message: "Sunucu hatası.",
    });
  }
});

module.exports = router;
