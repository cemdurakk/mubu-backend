// C:\Users\yasar\mubu-backend\routes\walletRoutes.js

const express = require("express");
const router = express.Router();
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction"); // 📌 Transaction modelini dahil et
const authMiddleware = require("../middleware/authMiddleware");
const FakeCard = require("../models/FakeCard");
const crypto = require("crypto");
const { sendSMS } = require("../services/smsService");


// ✅ Random 6 haneli 3D Secure kodu üret
function generate3DSCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

let pending3DSessions = {};

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
// ✅ Para yükleme (Fake Kart + 3D Secure)
router.post("/deposit", authMiddleware, async (req, res) => {
  try {
    const { cardNumber, expiryMonth, expiryYear, cvv, amount, threeDSecure } = req.body;
    const userId = req.user.userId;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Geçerli bir tutar giriniz" });
    }

    // Kartı bul
    const card = await FakeCard.findOne({ cardNumber });
    if (!card) {
      return res.status(404).json({ success: false, message: "Kart bulunamadı" });
    }

    // Kart bilgilerini kontrol et
    if (card.expiryMonth !== expiryMonth || card.expiryYear !== expiryYear || card.cvv !== cvv) {
      return res.status(400).json({ success: false, message: "Kart bilgileri hatalı" });
    }

    // Yeterli bakiye var mı?
    if (card.balance < amount) {
      return res.status(400).json({ success: false, message: "Kart bakiyesi yetersiz" });
    }

    // Eğer 3D Secure kapalıysa direkt işlemi tamamla
    if (threeDSecure === false) {
      card.balance -= amount;
      await card.save();

      let wallet = await Wallet.findOne({ userId });
      if (!wallet) wallet = new Wallet({ userId, balance: 0 });

      wallet.balance += amount;
      await wallet.save();

      const transaction = new Transaction({
        userId,
        type: "deposit",
        amount,
        description: `Kart ile ₺${amount} yüklendi (3D Secure olmadan)`,
        status: "completed",
        paymentMethod: "fake-card",
        cardLast4: card.cardNumber.slice(-4),
        secureVerified: false,
      });
      await transaction.save();

      return res.json({
        success: true,
        message: "Para yükleme başarılı (3D Secure olmadan)",
        wallet,
        transaction,
        requires3DSecure: false,
      });
    }

    // ✅ 3D Secure kodu üret
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const sessionId = crypto.randomBytes(16).toString("hex");

    pending3DSessions[sessionId] = {
      userId,
      cardNumber,
      amount,
      code,
      createdAt: Date.now(),
    };

    // ✅ SMS gönder
    if (card.phoneNumber) {
      await sendSMS(card.phoneNumber, `MUBU 3D Secure kodunuz: ${code}`);
    }

    console.log(`📲 3D Secure Kod: ${code} → ${card.phoneNumber}`);

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

    // Kartı bul
    const card = await FakeCard.findOne({ cardNumber: session.cardNumber });
    if (!card) {
      return res.status(404).json({ success: false, message: "Kart bulunamadı" });
    }

    // Bakiyeden düş
    card.balance -= session.amount;
    await card.save();

    // Kullanıcının cüzdanını bul
    let wallet = await Wallet.findOne({ userId: session.userId });
    if (!wallet) {
      wallet = new Wallet({ userId: session.userId, balance: 0 });
    }
    wallet.balance += session.amount;
    await wallet.save();

// Transaction kaydı
const transaction = new Transaction({
  userId: session.userId,
  type: "deposit",
  amount: session.amount,
  description: `Kart ile ₺${session.amount} yüklendi`,
  status: "completed", // ✅ ENUM’da var olan değer
  paymentMethod: "fake-card",
  cardLast4: card.cardNumber.slice(-4),
  secureVerified: true,
});

    await transaction.save();

    // Kullanıldıktan sonra session sil
    delete pending3DSessions[sessionId];

    res.json({
      success: true,
      message: "Para yükleme başarılı",
      wallet,
      transaction,
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
    const { amount } = req.body;
    const userId = req.user.userId;

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
    await wallet.save();

    // Transaction kaydı
    const transaction = new Transaction({
      userId,
      type: "withdraw", // ✅ işlem tipi
      amount,
      description: `Cüzdandan ₺${amount} çekildi`, // ✅ açıklama
      status: "completed", // ✅ ENUM’dan izinli değer
      paymentMethod: "wallet", // ✅ withdraw’da wallet diyelim
      secureVerified: false,
    });

    await transaction.save();

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
