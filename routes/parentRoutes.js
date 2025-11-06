const express = require("express");
const router = express.Router();
const User = require("../models/User");
const ParentSubscription = require("../models/ParentSubscription");
const authMiddleware = require("../middleware/authMiddleware");
const Notification = require("../models/Notification");
const Wallet = require("../models/Wallet");
const bcrypt = require("bcryptjs");
const { sendSMS } = require("../services/smsService");

async function generateUniqueInviteID() {
  let inviteID;
  let exists = true;
  while (exists) {
    inviteID = "#" + Math.floor(100000000 + Math.random() * 900000000);
    exists = await User.exists({ inviteID });
  }
  return inviteID;
}
/**
 * 🎯 1. Aktif ebeveyn abonelik bilgisi
 * GET /api/parent/subscription
 */
router.get("/subscription", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const subscription = await ParentSubscription.findOne({
      $or: [{ userId }, { spouseId: userId }],
    })
      .populate("userId", "name phone role")
      .populate("spouseId", "name phone role")
      .populate("children", "name phone role");

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Aktif ebeveyn aboneliği bulunamadı.",
      });
    }

    res.json({ success: true, subscription });
  } catch (err) {
    console.error("❌ Abonelik getirme hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası." });
  }
});

/**
 * 🎯 2. Çocuk ekleme (yeni çocuk hesabı oluşturma)
 * POST /api/parent/add-child
 */
router.post("/add-child", authMiddleware, async (req, res) => {
  try {
    const parentId = req.user.userId;
    const { name, phone, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    // 👨‍👩‍👧 Ebeveyn kontrolü
    const parent = await User.findById(parentId);
    if (!parent || parent.role !== "parent") {
      return res.status(403).json({
        success: false,
        message: "Sadece ebeveyn kullanıcılar çocuk ekleyebilir.",
      });
    }

    // 📞 Telefon kontrolü
    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Bu telefon numarası zaten kayıtlı.",
      });
    }

    // 👨‍👩‍👧 Parent ID listesi (eş varsa dahil et)
    const parentIds = [parentId];
    if (parent.wife_husband) parentIds.push(parent.wife_husband);

    // 🔹 Benzersiz davet kodu
    const inviteID = await generateUniqueInviteID();

    // 🔹 Doğrulama kodu
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 5 * 60 * 1000);

    // 🔹 1️⃣ User kaydı oluştur (isim burada yok)
    const child = new User({
      phone,
      password: hashedPassword,
      role: "child",
      parentIds,
      verified: false,
      inviteID,
      verificationCode,
      verificationExpires,
    });
    await child.save();

    // 🔹 2️⃣ ProfileInfo kaydı oluştur (isim burada)
    const ProfileInfo = require("../models/ProfileInfo");
    const profile = new ProfileInfo({
      userId: child._id,
      name, // ✅ isim burada tutulur
    });
    await profile.save();

    // Profile bağlantısını güncelle
    child.profileInfoId = profile._id;
    await child.save();

    // 🔹 3️⃣ Çocuğa cüzdan oluştur
    const childWallet = new Wallet({
      userId: child._id,
      balance: 0,
      name: `${name} Cüzdanı`,
    });
    await childWallet.save();

    // 🔹 4️⃣ SMS gönder
    await sendSMS(phone, `MUBU doğrulama kodunuz: ${verificationCode}`);

    // 🔹 5️⃣ Parent ve Subscription güncelle
    parent.children.push(child._id);
    await parent.save();

    if (parent.wife_husband) {
      const spouse = await User.findById(parent.wife_husband);
      if (spouse) {
        spouse.children.push(child._id);
        await spouse.save();
      }
    }

    const subscription = await ParentSubscription.findOne({
      $or: [{ userId: parentId }, { spouseId: parentId }],
    });
    if (subscription) {
      subscription.children.push(child._id);
      await subscription.save();
    }

    // 🔹 6️⃣ Bildirim oluştur
    await Notification.create({
      userId: parentId,
      type: "child_added",
      description: `${name} isimli çocuk hesabı oluşturuldu ve doğrulama kodu gönderildi.`,
      relatedUserId: child._id,
      status: "success",
    });

    // 🔹 7️⃣ Başarılı yanıt
// 🔹 7️⃣ Başarılı yanıt (Flutter ile uyumlu hale getirildi)
    res.json({
      success: true,
      message: "Çocuk hesabı oluşturuldu ve doğrulama kodu gönderildi.",
      childId: child._id, // ✅ Flutter burayı bekliyor
      phone: child.phone,
      name: profile.name,
    });
    
  } catch (err) {
    console.error("❌ Çocuk ekleme hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası." });
  }
});


/**
 * 🎯 2.1 Çocuk hesabı doğrulama kodu gönderme
 * POST /api/parent/send-child-code
 */
router.post("/send-child-code", authMiddleware, async (req, res) => {
  try {
    const { childId } = req.body;
    const parentId = req.user.userId;

    // 1️⃣ Çocuğu bul
    const child = await User.findById(childId);
    if (!child || child.role !== "child") {
      return res.status(404).json({
        success: false,
        message: "Çocuk hesabı bulunamadı.",
      });
    }

    // 2️⃣ Ebeveynlik kontrolü
    const isParent = child.parentIds.some((id) => id.toString() === parentId.toString());
    if (!isParent) {
      return res.status(403).json({
        success: false,
        message: "Bu çocuk size bağlı değil.",
      });
    }

    // 3️⃣ Çocuğun adını ProfileInfo'dan çek
    const ProfileInfo = require("../models/ProfileInfo");
    const profile = await ProfileInfo.findOne({ userId: child._id });

    // 4️⃣ Kod üret ve kaydet
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 dk geçerli

    child.verificationCode = code;
    child.verificationExpires = expires;
    await child.save();

    // 5️⃣ SMS gönder
    await sendSMS(child.phone, `MUBU doğrulama kodunuz: ${code}`);

    // 6️⃣ Bildirim kaydı
    await Notification.create({
      userId: parentId,
      type: "child_code_sent",
      description: `${profile?.name || "Çocuk"} için doğrulama kodu gönderildi.`,
      relatedUserId: child._id,
      status: "success",
    });

    res.json({
      success: true,
      message: `${profile?.name || "Çocuk"} için doğrulama kodu gönderildi.`,
    });
  } catch (err) {
    console.error("❌ Doğrulama kodu gönderme hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası." });
  }
});


/**
 * 🎯 2.2 Çocuk doğrulama kodu kontrolü
 * POST /api/parent/verify-child
 */
router.post("/verify-child", authMiddleware, async (req, res) => {
  try {
    const { childId, code } = req.body;
    const parentId = req.user.userId;

    // 1️⃣ Çocuğu bul
    const child = await User.findById(childId);
    if (!child || child.role !== "child") {
      return res.status(404).json({
        success: false,
        message: "Çocuk hesabı bulunamadı.",
      });
    }

    // 2️⃣ Ebeveynlik kontrolü
    const isParent = child.parentIds.some((id) => id.toString() === parentId.toString());
    if (!isParent) {
      return res.status(403).json({
        success: false,
        message: "Bu çocuk size bağlı değil.",
      });
    }

    // 3️⃣ Kod kontrolü
    if (!child.verificationCode || !child.verificationExpires) {
      return res.status(400).json({
        success: false,
        message: "Bu kullanıcıya ait aktif doğrulama kodu yok.",
      });
    }

    if (Date.now() > new Date(child.verificationExpires).getTime()) {
      return res.status(400).json({
        success: false,
        message: "Doğrulama kodunun süresi dolmuş.",
      });
    }

    if (child.verificationCode !== code) {
      return res.status(400).json({
        success: false,
        message: "Geçersiz doğrulama kodu.",
      });
    }

    // 4️⃣ Doğrulama başarılı → güncelle
    child.verified = true;
    child.verificationCode = null;
    child.verificationExpires = null;
    await child.save();

    // 5️⃣ Profil bilgisini al
    const ProfileInfo = require("../models/ProfileInfo");
    const profile = await ProfileInfo.findOne({ userId: child._id });

    // 6️⃣ Bildirim oluştur
    await Notification.create({
      userId: parentId,
      type: "child_verified",
      description: `${profile?.name || "Çocuk"} hesabı başarıyla doğrulandı.`,
      relatedUserId: child._id,
      status: "success",
    });

    res.json({
      success: true,
      message: `${profile?.name || "Çocuk"} hesabı başarıyla doğrulandı.`,
      verified: true,
    });
  } catch (err) {
    console.error("❌ Çocuk doğrulama hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası." });
  }
});


/**
 * 🎯 2.3 Çocuk için PIN oluşturma
 * POST /api/parent/create-child-pin
 */
router.post("/create-child-pin", authMiddleware, async (req, res) => {
  try {
    const parentId = req.user.userId;
    const { childId, pin } = req.body;

    // 1️⃣ Giriş kontrolü
    if (!childId || !pin || pin.length !== 5) {
      return res.status(400).json({
        success: false,
        message: "Geçerli bir çocuk ID ve 5 haneli PIN girilmelidir.",
      });
    }

    // 2️⃣ Ebeveyn & çocuk doğrulama
    const parent = await User.findById(parentId);
    const child = await User.findById(childId);
    if (!child || child.role !== "child") {
      return res.status(404).json({
        success: false,
        message: "Çocuk hesabı bulunamadı.",
      });
    }

    const isParent = child.parentIds.some((id) => id.toString() === parentId.toString());
    if (!isParent) {
      return res.status(403).json({
        success: false,
        message: "Bu çocuk size bağlı değil, işlem yapılamaz.",
      });
    }

    // 3️⃣ PIN kuralları
    const sequential = "0123456789";
    const isSequential =
      sequential.includes(pin) || sequential.includes(pin.split("").reverse().join(""));
    const isRepeated = /(.)\1{2,}/.test(pin); // aynı rakam 3+ tekrar ederse

    if (isSequential) {
      return res.status(400).json({
        success: false,
        message: "PIN sıralı olamaz (örnek: 12345 veya 54321).",
      });
    }
    if (isRepeated) {
      return res.status(400).json({
        success: false,
        message: "PIN 3 aynı rakamı arka arkaya içeremez.",
      });
    }

    // 4️⃣ PIN hashle
    const hashedPin = await bcrypt.hash(pin, 10);

    // 5️⃣ Kaydet
    child.pin = hashedPin;
    child.pinCreated = true;
    await child.save();

    // 6️⃣ Çocuğun adını ProfileInfo'dan çek
    const ProfileInfo = require("../models/ProfileInfo");
    const profile = await ProfileInfo.findOne({ userId: child._id });

    // 7️⃣ Bildirim oluştur
    await Notification.create({
      userId: parentId,
      type: "child_pin_created",
      description: `${profile?.name || "Çocuk"} için PIN başarıyla oluşturuldu.`,
      relatedUserId: child._id,
      status: "success",
    });

    // 8️⃣ Cevap döndür
    res.json({
      success: true,
      message: `${profile?.name || "Çocuk"} için PIN başarıyla oluşturuldu.`,
      pinCreated: true,
    });
  } catch (err) {
    console.error("❌ Çocuk PIN oluşturma hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası." });
  }
});

/**
 * 🎯 2.4 Çocuk profil bilgilerini tamamlama
 * POST /api/parent/complete-child-profile
 */
router.post("/complete-child-profile", authMiddleware, async (req, res) => {
  try {
    const parentId = req.user.userId;
    const { childId, dob, tcNo, email, city, district, securityQuestion, securityAnswer } = req.body;

    // 1️⃣ Giriş kontrolü
    if (!childId || !dob || !tcNo || !email || !city || !district) {
      return res.status(400).json({
        success: false,
        message: "Lütfen tüm profil bilgilerini giriniz.",
      });
    }

    // 2️⃣ Ebeveyn ve çocuk kontrolü
    const parent = await User.findById(parentId);
    const child = await User.findById(childId);

    if (!child || child.role !== "child") {
      return res.status(404).json({
        success: false,
        message: "Çocuk hesabı bulunamadı.",
      });
    }

    // 👨‍👩‍👧 Ebeveynlik kontrolü
    const isParent = child.parentIds.some((id) => id.toString() === parentId.toString());
    if (!isParent) {
      return res.status(403).json({
        success: false,
        message: "Bu çocuk size bağlı değil.",
      });
    }

    // 3️⃣ ProfileInfo kaydını getir veya oluştur
    const ProfileInfo = require("../models/ProfileInfo");
    let profile = await ProfileInfo.findOne({ userId: child._id });

    if (profile) {
      profile.dob = dob;
      profile.tcNo = tcNo;
      profile.email = email;
      profile.city = city;
      profile.district = district;
      await profile.save();
    } else {
      profile = new ProfileInfo({
        userId: child._id,
        dob,
        tcNo,
        email,
        city,
        district,
      });
      await profile.save();
    }

    // 4️⃣ Güvenlik sorusu & cevabı kaydet (opsiyonel)
    if (securityQuestion && securityAnswer) {
      child.securityQuestion = securityQuestion;
      child.securityAnswer = await bcrypt.hash(securityAnswer, 10);
    }

    // 5️⃣ Kullanıcı bilgilerini güncelle
    child.profileCompleted = true;
    child.profileInfoId = profile._id;
    await child.save();

    // 6️⃣ Bildirim oluştur
    await Notification.create({
      userId: parentId,
      type: "child_profile_completed",
      description: `${profile.name || "Çocuk"} için profil bilgileri tamamlandı.`,
      relatedUserId: child._id,
      status: "success",
    });

    // 7️⃣ Yanıt
    res.json({
      success: true,
      message: `${profile.name || "Çocuk"} için profil bilgileri başarıyla kaydedildi.`,
      profile,
    });
  } catch (err) {
    console.error("❌ Çocuk profil tamamlama hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası." });
  }
});




/**
 * 🎯 3. Eş daveti gönderme
 * POST /api/parent/invite-spouse
 */
router.post("/invite-spouse", authMiddleware, async (req, res) => {
  try {
    const parentId = req.user.userId;
    const { inviteId } = req.body;

    const parent = await User.findById(parentId);
    if (!parent || parent.role !== "parent") {
      return res.status(403).json({
        success: false,
        message: "Sadece ebeveyn kullanıcılar davet gönderebilir.",
      });
    }

    const spouse = await User.findOne({ inviteID: inviteId });
    if (!spouse) {
      return res.status(404).json({
        success: false,
        message: "Bu davet koduna sahip kullanıcı bulunamadı.",
      });
    }

    // eşlik zaten varsa reddet
    if (parent.wife_husband || spouse.wife_husband) {
      return res.status(400).json({
        success: false,
        message: "Bu kullanıcı zaten bir eşe bağlı.",
      });
    }

    // eşlik oluştur
    parent.wife_husband = spouse._id;
    spouse.wife_husband = parent._id;

    // eş de parent rolüne geçsin
    spouse.role = "parent";
    spouse.subscriptionActive = true;
    spouse.subscriptionExpiresAt = parent.subscriptionExpiresAt;

    await parent.save();
    await spouse.save();

    // ebeveynin aboneliğini güncelle
    const subscription = await ParentSubscription.findOne({ userId: parentId });
    if (subscription) {
      subscription.spouseId = spouse._id;
      await subscription.save();
    }

    await Notification.create({
      userId: parentId,
      type: "spouse_added",
      description: `${spouse.name} başarıyla eş olarak eklendi.`,
      status: "success",
    });

    res.json({
      success: true,
      message: "Eş başarıyla davet edildi ve ebeveyn rolüne geçirildi.",
    });
  } catch (err) {
    console.error("❌ Eş daveti hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası." });
  }
});

/**
 * 🎯 4. Ebeveynin çocuklarını listele (profil ve cüzdan bilgileriyle)
 * GET /api/parent/children
 */
router.get("/children", authMiddleware, async (req, res) => {
  try {
    const parentId = req.user.userId;

    // 1️⃣ Parent’a bağlı çocukları getir
    const children = await User.find({ parentIds: parentId })
      .select("verified pinCreated profileCompleted firstLoginCompleted role")
      .lean();

    if (!children.length) {
      return res.json({
        success: true,
        children: [],
        message: "Henüz kayıtlı bir çocuk bulunmuyor.",
      });
    }

    // 2️⃣ Tüm çocukların profil adını ve cüzdan bakiyesini getir
    const ProfileInfo = require("../models/ProfileInfo");
    const Wallet = require("../models/Wallet");

    const enrichedChildren = await Promise.all(
      children.map(async (child) => {
        const profile = await ProfileInfo.findOne({ userId: child._id });
        const wallet = await Wallet.findOne({ userId: child._id });

        // 🔹 Durum hesapla
        let status = "active";
        if (!child.verified) status = "pendingVerification";
        else if (!child.pinCreated) status = "pinNotCreated";
        else if (!child.profileCompleted) status = "profileIncomplete";

        return {
          id: child._id,
          name: profile?.name || "İsimsiz Kullanıcı",
          verified: child.verified,
          pinCreated: child.pinCreated,
          profileCompleted: child.profileCompleted,
          firstLoginCompleted: child.firstLoginCompleted,
          walletBalance: wallet ? wallet.balance : 0,
          role: child.role,
          status, // ✅ Flutter tarafı bunu kullanacak
        };
      })
    );


    res.json({ success: true, children: enrichedChildren });
  } catch (err) {
    console.error("❌ Çocukları getirme hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası." });
  }
});


/**
 * 🎯 5. Harçlık gönderme (ebeveyn → çocuk)
 * POST /api/parent/send-allowance
 */
router.post("/send-allowance", authMiddleware, async (req, res) => {
  try {
    const parentId = req.user.userId;
    const { childId, amount } = req.body;
    const sendAmount = Number(amount);

    // 1️⃣ Kontroller
    if (!childId || !sendAmount || sendAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Geçerli bir çocuk ve tutar belirtilmelidir.",
      });
    }

    const parent = await User.findById(parentId);
    if (!parent || parent.role !== "parent") {
      return res.status(403).json({
        success: false,
        message: "Sadece ebeveyn kullanıcılar harçlık gönderebilir.",
      });
    }

    const child = await User.findById(childId);
    if (!child || child.role !== "child") {
      return res.status(404).json({
        success: false,
        message: "Geçersiz çocuk hesabı.",
      });
    }

    // 2️⃣ İlişki kontrolü
    const isParent = child.parentIds.some((id) => id.toString() === parentId.toString());
    if (!isParent) {
      return res.status(403).json({
        success: false,
        message: "Bu çocuk size bağlı değil, işlem yapılamaz.",
      });
    }

    // 3️⃣ Cüzdan işlemleri
    const parentWallet = await Wallet.findOne({ userId: parentId });
    const childWallet = await Wallet.findOne({ userId: childId });
    if (!parentWallet || !childWallet) {
      return res.status(404).json({ success: false, message: "Cüzdan bilgileri bulunamadı." });
    }

    if (parentWallet.balance < sendAmount) {
      return res.status(400).json({
        success: false,
        message: "Yetersiz bakiye.",
      });
    }

    parentWallet.balance -= sendAmount;
    childWallet.balance += sendAmount;

    await parentWallet.save();
    await childWallet.save();

    // 4️⃣ Bildirim oluştur
    await Notification.create([
      {
        userId: parentId,
        type: "allowance_sent",
        description: `${child.name} isimli çocuğa ₺${sendAmount} harçlık gönderildi.`,
        relatedUserId: childId,
        status: "success",
      },
      {
        userId: childId,
        type: "allowance_received",
        description: `${parent.name} size ₺${sendAmount} harçlık gönderdi.`,
        relatedUserId: parentId,
        status: "success",
      },
    ]);

    res.json({
      success: true,
      message: `${child.name} isimli çocuğa ₺${sendAmount} harçlık başarıyla gönderildi.`,
      newBalance: parentWallet.balance,
    });
  } catch (err) {
    console.error("❌ Harçlık gönderme hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası." });
  }
});

/**
 * 🎯 6. Çocuğun kayıt aşamasını getir (hangi adımda kaldı)
 * GET /api/parent/child-status/:childId
 */
router.get("/child-status/:childId", authMiddleware, async (req, res) => {
  try {
    const { childId } = req.params;
    const parentId = req.user.userId;

    // 1️⃣ Çocuğu getir
    const child = await User.findById(childId).select(
      "verified pinCreated profileCompleted firstLoginCompleted parentIds"
    );

    if (!child) {
      return res.status(404).json({
        success: false,
        message: "Çocuk bulunamadı.",
      });
    }

    // 2️⃣ Ebeveynlik kontrolü
    const isParent = child.parentIds?.some(
      (id) => id.toString() === parentId.toString()
    );
    if (!isParent) {
      return res.status(403).json({
        success: false,
        message: "Bu çocuk size bağlı değil.",
      });
    }

    // 3️⃣ Çocuğun profil adını ProfileInfo'dan çek
    const ProfileInfo = require("../models/ProfileInfo");
    const profile = await ProfileInfo.findOne({ userId: child._id });

    // 4️⃣ Hangi adımda kaldığını belirle
    let nextStep = "completed";
    if (!child.verified) nextStep = "verify";
    else if (!child.pinCreated) nextStep = "createPin";
    else if (!child.profileCompleted) nextStep = "profileInfo";

    // 5️⃣ Cevap dön
    res.json({
      success: true,
      child: {
        id: child._id,
        name: profile?.name || "İsimsiz Kullanıcı",
        verified: child.verified,
        pinCreated: child.pinCreated,
        profileCompleted: child.profileCompleted,
        firstLoginCompleted: child.firstLoginCompleted,
      },
      nextStep, // verify | createPin | profileInfo | completed
    });
  } catch (err) {
    console.error("❌ Çocuk durum getirme hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası." });
  }
});


// 📂 routes/parentRoutes.js
router.get("/allowance-history", authMiddleware, async (req, res) => {
  try {
    const parentId = req.user.userId;
    const notifications = await Notification.find({
      userId: parentId,
      type: "allowance_sent",
    })
      .populate("relatedUserId", "name phone")
      .sort({ createdAt: -1 });

    res.json({ success: true, notifications });
  } catch (err) {
    console.error("❌ Harçlık geçmişi hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası." });
  }
});


module.exports = router;
