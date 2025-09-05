const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const { sendSms } = require("../services/smsService");

const router = express.Router();

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 haneli kod
}

// 📌 Register endpoint
router.post("/register", async (req, res) => {
  try {
    const { phone, password } = req.body;

    let user = await User.findOne({ phone });

    if (user) {
      if (!user.verified) {
        return res.status(400).json({
          message: "Bu numara zaten kayıtlı, doğrulama kodunu tekrar göndermek ister misiniz?",
          pending: true,
        });
      }
      return res.status(400).json({ message: "Bu numara zaten kayıtlı" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const code = generateCode();

    user = new User({
      phone,
      password: hashedPassword,
      verified: false,
      verificationCode: code,
      verificationExpires: Date.now() + 5 * 60 * 1000, // 5 dakika
    });

    await user.save();

    await sendSms(phone, `MUBU doğrulama kodunuz: ${code}`);

    res.json({ message: "Kayıt başarılı, doğrulama kodu gönderildi" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

// 📌 Doğrulama endpoint
router.post("/verify", async (req, res) => {
  try {
    const { phone, code } = req.body;
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(400).json({ message: "Kullanıcı bulunamadı" });
    }

    if (user.verified) {
      return res.status(400).json({ message: "Kullanıcı zaten doğrulanmış" });
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({ message: "Kod hatalı" });
    }

    if (user.verificationExpires < Date.now()) {
      return res.status(400).json({ message: "Kodun süresi dolmuş" });
    }

    user.verified = true;
    user.verificationCode = undefined;
    user.verificationExpires = undefined;
    await user.save();

    res.json({ message: "Doğrulama başarılı" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

// 📌 Kod yeniden gönderme endpoint
router.post("/resend-code", async (req, res) => {
  try {
    const { phone } = req.body;
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(400).json({ message: "Kullanıcı bulunamadı" });
    }

    if (user.verified) {
      return res.status(400).json({ message: "Kullanıcı zaten doğrulanmış" });
    }

    const code = generateCode();
    user.verificationCode = code;
    user.verificationExpires = Date.now() + 5 * 60 * 1000;
    await user.save();

    await sendSms(phone, `MUBU yeni doğrulama kodunuz: ${code}`);

    res.json({ message: "Yeni doğrulama kodu gönderildi" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

module.exports = router;
