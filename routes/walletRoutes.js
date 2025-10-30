// C:\Users\yasar\mubu-backend\routes\walletRoutes.js

const express = require("express");
const router = express.Router();
const Wallet = require("../models/Wallet");
const Notification = require("../models/Notification"); // 📌 Transaction yerine Notification
const authMiddleware = require("../middleware/authMiddleware");
const FakeCard = require("../models/FakeCard");
const crypto = require("crypto");
const { sendSMS } = require("../services/smsService");

// ✅ Random 6 haneli 3D Secure kodu üret
function generate3DSCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

let pending3DSessions = {};

// ✅ Kullanıcının kendi cüzdanını getir (token’dan userId alarak)
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(404).json({ success: false, message: "Cüzdan bulunamadı" });
    }

    res.json({
      success: true,
      wallet: {
        _id: wallet._id,
        name: wallet.name,
        balance: wallet.balance,
      },
    });
  } catch (err) {
    console.error("❌ Wallet /me error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


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

// ✅ Para yükleme (Fake Kart + 3D Secure)
router.post("/deposit", authMiddleware, async (req, res) => {
  try {
    const { cardNumber, expiryMonth, expiryYear, cvv, amount, threeDSecure, walletId } = req.body;
    const userId = req.user.userId;

    if (!walletId) {
      return res.status(400).json({ success: false, message: "Cüzdan ID gerekli" });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Geçerli bir tutar giriniz" });
    }

    const card = await FakeCard.findOne({ cardNumber });
    if (!card) {
      return res.status(404).json({ success: false, message: "Kart bulunamadı" });
    }

    // 📌 Kart bilgilerini kontrol et
    if (
      card.expiryMonth !== expiryMonth ||
      card.expiryYear !== expiryYear ||
      card.cvv !== cvv ||
      card.ownerName.toLowerCase() !== req.body.cardName.toLowerCase()
    ) {
      return res.status(400).json({ success: false, message: "Kart bilgileri hatalı" });
    }

    if (card.balance < amount) {
      return res.status(400).json({ success: false, message: "Kart bakiyesi yetersiz" });
    }

    // Eğer 3D Secure kapalıysa direkt tamamla
    if (threeDSecure === false) {
      card.balance -= amount;
      await card.save();

      let wallet = await Wallet.findOne({ _id: walletId, userId });
      if (!wallet) {
        return res.status(404).json({ success: false, message: "Cüzdan bulunamadı" });
      }

      wallet.balance += amount;
      await wallet.save();

      const notification = new Notification({
        userId,
        walletId,
        type: "deposit",
        amount,
        description: `${card.ownerName} kişisinin kartından ₺${amount} yüklendi`,
        status: "completed",
        paymentMethod: "fake-card",
        cardLast4: card.cardNumber.slice(-4),
        secureVerified: false,
      });
      await notification.save();

      return res.json({
        success: true,
        message: "Para yükleme başarılı",
        wallet,
        notification,
        requires3DSecure: false,
      });
    }

    // ✅ 3D Secure
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const sessionId = crypto.randomBytes(16).toString("hex");

    pending3DSessions[sessionId] = {
      userId,
      walletId,
      cardNumber,
      amount,
      code,
      createdAt: Date.now(),
    };

    if (card.phoneNumber) {
      await sendSMS(card.phoneNumber, `MUBU 3D Secure kodunuz: ${code}`);
    }

    return res.json({
      success: true,
      message: "3D Secure doğrulama gerekli",
      sessionId,
      requires3DSecure: true,
    });
  } catch (err) {
    console.error("❌ Deposit hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

// ✅ 3D Secure doğrulama endpoint
router.post("/deposit/verify-3d", authMiddleware, async (req, res) => {
  try {
    const { sessionId, code } = req.body;
    const session = pending3DSessions[sessionId];

    if (!session) {
      return res.status(400).json({ success: false, message: "Geçersiz oturum" });
    }

    if (session.code !== code) {
      return res.status(400).json({ success: false, message: "3D Secure kodu hatalı" });
    }

    const card = await FakeCard.findOne({ cardNumber: session.cardNumber });
    if (!card) {
      return res.status(404).json({ success: false, message: "Kart bulunamadı" });
    }

    card.balance -= session.amount;
    await card.save();

    let wallet = await Wallet.findOne({ _id: session.walletId, userId: session.userId });
    if (!wallet) {
      return res.status(404).json({ success: false, message: "Cüzdan bulunamadı" });
    }

    wallet.balance += session.amount;
    await wallet.save();

    const notification = new Notification({
      userId: session.userId,
      walletId: session.walletId,
      type: "deposit",
      amount: session.amount,
      description: `${card.ownerName} kişisinin kartından ₺${session.amount} yüklendi`,
      status: "completed",
      paymentMethod: "fake-card",
      cardLast4: card.cardNumber.slice(-4),
      secureVerified: true,
    });
    await notification.save();

    delete pending3DSessions[sessionId];

    res.json({
      success: true,
      message: "Para yükleme başarılı",
      wallet,
      notification,
    });
  } catch (err) {
    console.error("❌ 3D doğrulama hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
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
    const { amount, iban, ownerName, walletId } = req.body;
    const userId = req.user.userId;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Geçerli bir tutar giriniz" });
    }

    if (!iban || !ownerName) {
      return res.status(400).json({ success: false, message: "IBAN ve Ad Soyad zorunludur" });
    }

    let wallet = await Wallet.findOne({ _id: walletId, userId });
    if (!wallet) {
      return res.status(404).json({ success: false, message: "Cüzdan bulunamadı" });
    }

    if (wallet.balance < amount) {
      return res.status(400).json({ success: false, message: "Yetersiz bakiye" });
    }

    // 📌 IBAN & Ad Soyad doğrulaması
    const cleanIban = iban.replace(/\s+/g, "").toUpperCase();
    const card = await FakeCard.findOne({
      iban: cleanIban,
      ownerName: { $regex: new RegExp("^" + ownerName.trim() + "$", "i") },
    });

    if (!card) {
      return res.status(400).json({ success: false, message: "IBAN veya isim hatalı" });
    }

    // 1️⃣ Kullanıcının cüzdanından düş
    wallet.balance -= amount;
    await wallet.save();

    // 2️⃣ IBAN sahibinin kart bakiyesine ekle
    card.balance += amount;
    await card.save();

    // Notification kaydı
    const notification = new Notification({
      userId,
      walletId,
      type: "withdraw",
      amount,
      description: `${ownerName} kişisinin IBAN'ı için ₺${amount} çekildi`,
      status: "completed",
      paymentMethod: "iban",
      secureVerified: false,
    });
    await notification.save();

    res.json({
      success: true,
      message: `${amount} TL cüzdandan çekildi`,
      wallet,
      notification,
    });
  } catch (err) {
    console.error("❌ Withdraw error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ Kullanıcının tüm cüzdanlarını getir
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const wallets = await Wallet.find({ userId });

    if (!wallets || wallets.length === 0) {
      return res.status(404).json({ success: false, message: "Cüzdan bulunamadı" });
    }

    // Sadece gerekli alanları döndür
    const formattedWallets = wallets.map((w) => ({
      _id: w._id,
      name: w.name,
      balance: w.balance,
    }));

    res.json({ success: true, wallets: formattedWallets });
  } catch (err) {
    console.error("❌ Wallets get error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ Aile Yönetim Planı Satın Al (Ebeveyn Paketi)
router.post("/purchase-plan", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { walletId, amount } = req.body;

    // Paket fiyatı sabit 1000 TL (güvenlik için sabit tut)
    const packagePrice = 1000;

    const wallet = await Wallet.findOne({ _id: walletId, userId });
    if (!wallet) {
      return res.status(404).json({ success: false, message: "Cüzdan bulunamadı" });
    }

    if (wallet.balance < packagePrice) {
      return res.status(400).json({ success: false, message: "Yetersiz bakiye" });
    }

    // Kullanıcının mevcut bilgilerini al
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    // Zaten parent ise yeniden satın alınamaz
    if (user.role === "parent" && user.subscriptionActive) {
      return res.status(400).json({ success: false, message: "Zaten aktif bir ebeveyn planınız var" });
    }

    // 💸 Bakiyeden düş
    wallet.balance -= packagePrice;
    await wallet.save();

    // 👨‍👩‍👧 Kullanıcı rolünü değiştir
    user.role = "parent";
    user.subscriptionActive = true;
    user.subscriptionExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 yıl
    await user.save();

    // 🔔 Notification kaydı oluştur
    const notification = new Notification({
      userId,
      walletId,
      type: "subscription_purchase",
      amount: packagePrice,
      description: "Aile Yönetim Planı (1 Yıl) satın alındı",
      status: "completed",
      paymentMethod: "wallet",
      secureVerified: false,
    });
    await notification.save();

    // (Opsiyonel) SMS bilgilendirmesi gönder
    // await sendSMS(user.phone, "Tebrikler! Aile Yönetim Planı'nız 1 yıl boyunca aktif edildi.");

    return res.json({
      success: true,
      message: "Aile Yönetim Planı başarıyla satın alındı",
      newRole: user.role,
      subscriptionActive: user.subscriptionActive,
      expiresAt: user.subscriptionExpiresAt,
      wallet,
      notification,
    });
  } catch (err) {
    console.error("❌ Paket satın alma hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});



module.exports = router;
