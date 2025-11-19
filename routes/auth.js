const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const ProfileInfo = require("../models/ProfileInfo"); 
const { sendSMS } = require("../services/smsService");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../middleware/authMiddleware");
const Wallet = require("../models/Wallet");

const router = express.Router();

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 haneli kod
}

function generateToken(user) {
  return jwt.sign(
    {
      userId: user._id,
      phone: user.phone,
      role: user.role,       // ✅ rol bilgisi token’a eklendi
      deviceId: user.deviceId,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

async function generateUniqueInviteID() {
  let inviteID;
  let exists = true;
  while (exists) {
    inviteID = "#" + Math.floor(100000000 + Math.random() * 900000000);
    exists = await User.exists({ inviteID });
  }
  return inviteID;
}



// 📌 Register endpoint (güncellenmiş)
router.post("/register", async (req, res) => {
  console.log("📩 Gelen register body:", req.body);

  try {
    const { phone, password, fullName } = req.body;

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
      inviteID: await generateUniqueInviteID(), // 👈 burada ID üretiliyor
    });

    await user.save();

    // 📌 Kullanıcı için cüzdan oluştur
    const wallet = new Wallet({
      userId: user._id,
      balance: 0,
      name: "Cüzdanım",
    });
    await wallet.save();

    // 📌 Aynı anda ProfileInfo dokümanı oluştur
    const profile = new ProfileInfo({
      userId: user._id,
      name: fullName || "",
    });
    await profile.save();

    // SMS gönder
    await sendSMS(phone, `MUBU doğrulama kodunuz: ${code}`);

    // 📌 Token üret ve döndür
    const token = generateToken(user);

    res.json({
      success: true,
      message: "Kayıt başarılı, doğrulama kodu gönderildi",
      userId: user._id,
      token,   // ✅ token artık burada
    });

  } catch (err) {
    console.error("❌ Register error:", err);
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

    await sendSMS(phone, `MUBU yeni doğrulama kodunuz: ${code}`);

    res.json({ message: "Yeni doğrulama kodu gönderildi" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

// PIN oluşturma
router.post("/create-pin", async (req, res) => {
  try {
    const { phone, pin } = req.body;

    if (!phone || !pin) {
      return res.status(400).json({ success: false, message: "Eksik bilgi" });
    }

    // bcrypt ile PIN hashle
    const hashedPin = await bcrypt.hash(pin, 10);

    const user = await User.findOneAndUpdate(
      { phone },
      { pin: hashedPin, pinCreated: true },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    res.json({ success: true, message: "PIN başarıyla oluşturuldu", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/complete-profile", async (req, res) => {
  try {
    const { phone, dob, tcNo, email, city, district, securityQuestion, securityAnswer } = req.body;

    // Kullanıcıyı bul
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    // Profil daha önce oluşturulmuş mu kontrol et
    let profile = await ProfileInfo.findOne({ userId: user._id });

    if (profile) {
      profile.dob = dob;
      profile.tcNo = tcNo;
      profile.email = email;
      profile.city = city;
      profile.district = district;
      await profile.save();
    } else {
      profile = new ProfileInfo({
        userId: user._id,
        dob,
        tcNo,
        email,
        city,
        district,
      });
      await profile.save();
    }

    // Güvenlik sorusu & cevap kaydet (bcrypt ile hashle)
    if (securityQuestion && securityAnswer) {
      user.securityQuestion = securityQuestion;
      user.securityAnswer = await bcrypt.hash(securityAnswer, 10);
    }

    // User tablosunu güncelle → profil tamamlandı
    user.profileCompleted = true;
    await user.save();

    // ✅ Profil tamamlandıktan sonra otomatik 7 kumbara oluştur
    try {
      const SubWallet = require("../models/SubWallet");
      const PiggyBank = require("../models/PiggyBank");

      // 1️⃣ Kullanıcının individual subwallet'ını kontrol et / oluştur
      let subWallet = await SubWallet.findOne({ userId: user._id, type: "individual" });
      if (!subWallet) {
        subWallet = new SubWallet({
          userId: user._id,
          type: "individual",
          participants: [user._id],
          piggyBanks: [],
        });
        await subWallet.save();
      }

      // 2️⃣ Otomatik oluşturulacak kumbaralar
      const defaultPiggyBanks = [
        { name: "Abonelik", color: "#7E57C2" },
        { name: "Kahve", color: "#FF7043" },
        { name: "Yemek", color: "#66BB6A" },
        { name: "Fatura", color: "#42A5F5" },
        { name: "Giyim", color: "#AB47BC" },
        { name: "Market", color: "#FFA726" },
        { name: "Eğlence", color: "#EC407A" },
      ];

      // 3️⃣ Kumbara kayıtlarını paralel oluştur
      const createdPiggyBanks = await Promise.all(
        defaultPiggyBanks.map(data =>
          PiggyBank.create({
            subWalletId: subWallet._id,
            name: data.name,
            color: data.color,
            targetAmount: 0,
            currentAmount: 0,
            participants: [user._id],
            owner: user._id,
          })
        )
      );

      // 4️⃣ SubWallet’a ekle ve kaydet
      subWallet.piggyBanks.push(...createdPiggyBanks.map(pb => pb._id));
      await subWallet.save();

      console.log(`✅ Kullanıcı ${user._id} için ${createdPiggyBanks.length} otomatik kumbara oluşturuldu.`);
    } catch (autoErr) {
      console.error("❌ Otomatik kumbara oluşturma hatası:", autoErr);
    }



    res.json({
      success: true,
      message: "Profil bilgileri kaydedildi",
      profile,
    });
  } catch (err) {
    console.error("❌ Profil kaydetme hatası:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});



// 📌 Login (şifre ile giriş)
router.post("/login", async (req, res) => {
  try {
    const { phone, password, deviceId } = req.body;
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(400).json({ status: "error", message: "Kullanıcı bulunamadı" });
    }

    // ✅ Önce şifreyi kontrol et
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ status: "error", message: "Şifre hatalı" });
    }

    // ✅ Cihaz kontrolü
    if (user.deviceId && user.deviceId !== deviceId) {
      return res.json({
        status: "deviceVerification",
        message: "Farklı cihazdan giriş yapılıyor. Doğrulama gerekli."
      });
    }

    // ✅ Eğer verified değilse → verify ekranı
    if (!user.verified) {
      return res.json({ status: "verify", message: "Doğrulama kodu gerekli" });
    }

    // ✅ Eğer PIN oluşturulmadıysa → createPin ekranı
    if (!user.pinCreated) {
      return res.json({ status: "createPin", message: "PIN oluşturmanız gerekiyor" });
    }

    // ✅ Eğer profil tamamlanmadıysa → profileInfo ekranı
    if (!user.profileCompleted) {
      return res.json({ status: "profileInfo", message: "Profil bilgilerini doldurmanız gerekiyor" });
    }

    // ✅ İlk login tamamlandıysa → PIN login
    if (user.firstLoginCompleted) {
      return res.json({ status: "loginPin", message: "PIN ile giriş yapmalısınız" });
    }

    // ✅ İlk login değilse → direkt home
    user.firstLoginCompleted = true;
    user.deviceId = deviceId; // 📌 cihaz kaydedilir
    await user.save();

    const token = generateToken(user);

    return res.json({
      status: "home",
      message: "Giriş başarılı",
      token,
      user: {
        phone: user.phone,
        role: user.role,           // ✅ role eklendi
        verified: user.verified,
        pinCreated: user.pinCreated,
        profileCompleted: user.profileCompleted,
        firstLoginCompleted: user.firstLoginCompleted,
      },
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Sunucu hatası" });
  }
});



// 📌 Login (PIN ile giriş)
router.post("/login-pin", async (req, res) => {
  try {
    const { phone, pin } = req.body;
    const user = await User.findOne({ phone });

    if (!user || !user.pin) {
      return res.status(400).json({ status: "error", message: "Kullanıcı veya PIN bulunamadı" });
    }

    const isMatch = await bcrypt.compare(pin, user.pin);
    if (!isMatch) {
      return res.status(400).json({ status: "error", message: "PIN hatalı" });
    }

    const token = generateToken(user);

    return res.json({
      status: "home",
      message: "PIN ile giriş başarılı",
      token,
      user: {
        phone: user.phone,
        role: user.role,   // ✅ burada da role eklendi
      },
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Sunucu hatası" });
  }
});

// 📌 Cihaz doğrulama endpoint
router.post("/verify-device", async (req, res) => {
  try {
    const { phone, deviceId, tcNo, dob, securityQuestion, securityAnswer } = req.body;

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    // Profil bilgilerini kontrol et
    const profile = await ProfileInfo.findOne({ userId: user._id });
    if (!profile) {
      return res.status(404).json({ success: false, message: "Profil bulunamadı" });
    }

    if (profile.tcNo !== tcNo) {
      return res.status(400).json({ success: false, message: "TC Kimlik No hatalı" });
    }

    if (profile.dob !== dob) {
      return res.status(400).json({ success: false, message: "Doğum tarihi hatalı" });
    }

    // Güvenlik sorusu & cevabı kontrol
    if (user.securityQuestion !== securityQuestion) {
      return res.status(400).json({ success: false, message: "Güvenlik sorusu hatalı" });
    }

    const isAnswerMatch = await bcrypt.compare(securityAnswer, user.securityAnswer || "");
    if (!isAnswerMatch) {
      return res.status(400).json({ success: false, message: "Güvenlik cevabı hatalı" });
    }

    // ✅ Doğruysa cihaz kaydet
    user.deviceId = deviceId;
    await user.save();

    const token = generateToken(user);

    return res.json({
      success: true,
      message: "Cihaz doğrulama başarılı, cihaz değiştirildi.",
      token,
      user: {
        phone: user.phone,
        verified: user.verified,
        pinCreated: user.pinCreated,
        profileCompleted: user.profileCompleted,
        firstLoginCompleted: user.firstLoginCompleted,
      },
    });
  } catch (err) {
    console.error("❌ Cihaz doğrulama hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});


router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });

    // ProfileInfo tablosundan ek bilgileri çek
    const profile = await ProfileInfo.findOne({ userId: user._id });

    res.json({
      success: true,
      user: {
        _id: user._id,
        phone: user.phone,
        name: profile ? profile.name : user.name,
        inviteID: user.inviteID,
        role: user.role,
        verified: user.verified,
        pinCreated: user.pinCreated,
        profileCompleted: user.profileCompleted,
        firstLoginCompleted: user.firstLoginCompleted,
        avatar: profile?.avatar || null,
      },
    });
  } catch (err) {
    console.error("❌ /me endpoint error:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

// 📌 Kullanıcıyı InviteID ile arama endpoint'i
router.get("/search/:inviteID", authMiddleware, async (req, res) => {
  try {
    const { inviteID } = req.params;

    // Davet ID'si geçerli mi kontrol et
    if (!inviteID || !inviteID.startsWith("#")) {
      return res.status(400).json({ success: false, message: "Geçersiz davet kodu" });
    }

    // Kullanıcıyı bul
    const user = await User.findOne({ inviteID });

    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    // Kullanıcının temel profil bilgilerini al
    const profile = await ProfileInfo.findOne({ userId: user._id });

    return res.json({
      success: true,
      user: {
        _id: user._id,
        name: profile?.name || "İsimsiz Kullanıcı",
        phone: user.phone,
        inviteID: user.inviteID,
      },
    });
  } catch (err) {
    console.error("❌ Kullanıcı arama hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});






module.exports = router;
