const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const PiggyBank = require("../models/PiggyBank");
const SubWallet = require("../models/SubWallet");
const mongoose = require("mongoose");

// ✅ Yeni kumbara oluştur (davet destekli)
// ✅ Yeni kumbara oluştur (sadece owner için SubWallet oluşturur)
router.post("/create", authMiddleware, async (req, res) => {
  try {
    const { type, name, targetAmount, currentAmount, category, color, invitedUsers = [] } = req.body;
    const userId = req.user.userId;

    if (!type) {
      return res.status(400).json({ success: false, error: "Kumbara türü (type) gerekli" });
    }

    // 🎯 Kullanıcının sadece kendi SubWallet'ını oluştur
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

    // 🎯 Kumbara oluştur
    const piggyBank = new PiggyBank({
      subWalletId: subWallet._id,
      name,
      targetAmount: type === "savings" ? targetAmount || 0 : 0,
      currentAmount: currentAmount || 0,
      category,
      color,
      participants: [userId], // sadece kurucu katılımcı
      pendingInvites: [],
      owner: userId,
    });

    // 🔹 Davetliler varsa pendingInvites’e ekle
    if (Array.isArray(invitedUsers) && invitedUsers.length > 0) {
      const User = require("../models/User");
      const validUsers = [];

      for (const inviteID of invitedUsers) {
        const user = await User.findOne({ inviteID });
        if (user && user._id.toString() !== userId) {
          validUsers.push(user._id);
        }
      }

      piggyBank.pendingInvites = validUsers;
    }

    await piggyBank.save();

    // 🔹 Transaction kaydı oluştur
    const Transaction = require("../models/Transaction");
    await Transaction.create({
      userId,
      piggyBankId: piggyBank._id,
      piggyBankName: piggyBank.name,
      subWalletType: type || null,
      type: "piggybank_create",
      amount: piggyBank.currentAmount || 0,
      description: `"${piggyBank.name}" adlı ${type} tipinde kumbara oluşturuldu.`,
      status: "completed",
      createdAt: new Date(),
    });

    // 📨 Davet bildirimi gönder
    if (piggyBank.pendingInvites.length > 0) {
      const Notification = require("../models/Notification");
      const ProfileInfo = require("../models/ProfileInfo");
      const inviterProfile = await ProfileInfo.findOne({ userId });
      const inviterName = inviterProfile?.name || "Bir kullanıcı";

      for (const invitedUserId of piggyBank.pendingInvites) {
        await Notification.create({
          userId: invitedUserId,
          type: "piggybank_invite",
          amount: 0,
          description: `${inviterName} kullanıcısı tarafından "${piggyBank.name}" adlı kumbaraya davet edildiniz.`,
          status: "completed",
        });
      }
    }

    // 🎯 Sadece kurucunun SubWallet'ına ekle
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
    const userId = req.user.userId;  // ✅ doğru alan

    // Kullanıcının bulunduğu tüm subWallet’ları getir
    const subWallets = await SubWallet.find({ participants: userId })
      .populate({
        path: "piggyBanks",
        populate: {
          path: "subWalletId",
          select: "type", // sadece type alanını getir
        },
      });


    // Tüm kumbaraları birleştir
    let piggyBanks = [];
    subWallets.forEach(sw => {
      piggyBanks = piggyBanks.concat(sw.piggyBanks);
    });

    // Kullanılan toplam bakiye (targetAmount’ların toplamı)
    const usedBalance = piggyBanks.reduce((sum, p) => sum + (p.currentAmount || 0), 0);

    // Tarihe göre sırala (son eklenenler önce gelsin)
    piggyBanks.sort((a, b) => b.createdAt - a.createdAt);

    return res.status(200).json({
      success: true,
      piggyBanks,
      usedBalance, // ✅ eklendi
    });
  } catch (err) {
    console.error("❌ Tüm kumbaraları listeleme hatası:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});



// 📩 Kullanıcı davet et
router.post("/invite", authMiddleware, async (req, res) => {
  try {
    const { piggyBankId, inviteID } = req.body;
    const inviterId = req.user.userId;
    
    if (!piggyBankId || !inviteID) {
      return res.status(400).json({ success: false, message: "Eksik bilgi" });
    }

    const User = require("../models/User");
    const ProfileInfo = require("../models/ProfileInfo");
    const Notification = require("../models/Notification");

    // Davet edilen kullanıcıyı bul
    const invitedUser = await User.findOne({ inviteID });
    if (!invitedUser) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
    }

    if (invitedUser._id.toString() === inviterId) {
      return res.status(400).json({ success: false, message: "Kendini davet edemezsin" });
    }

    const piggyBank = await PiggyBank.findById(piggyBankId);
    if (!piggyBank) {
      return res.status(404).json({ success: false, message: "Kumbara bulunamadı" });
    }

    const alreadyParticipant = piggyBank.participants.includes(invitedUser._id);
    const alreadyInvited = piggyBank.pendingInvites.includes(invitedUser._id);
    if (alreadyParticipant || alreadyInvited) {
      return res.status(400).json({ success: false, message: "Bu kullanıcı zaten eklendi veya davetli" });
    }

    piggyBank.pendingInvites.push(invitedUser._id);
    await piggyBank.save();

    // 📨 Davet eden kullanıcının adını al
    const inviterProfile = await ProfileInfo.findOne({ userId: inviterId });
    const inviterName = inviterProfile?.name || "Bir kullanıcı";

    // 📩 Davet edilen kişiye bildirim oluştur
    try {
      await Notification.create({
        userId: invitedUser._id,
        type: "piggybank_invite",
        amount: 0,
        description: `${inviterName} kullanıcısı tarafından "${piggyBank.name}" adlı kumbaraya davet edildiniz.`,
        status: "completed",
      });
      console.log("✅ Davet bildirimi başarıyla oluşturuldu!");
    } catch (notifyErr) {
      console.error("❌ Notification create error:", notifyErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `${inviteID} kullanıcı ID'sine sahip kullanıcı davet edildi.`,
    });
  } catch (err) {
    console.error("❌ Davet hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});



// ✅ Daveti kabul et
// ✅ Daveti kabul et (kabul eden için SubWallet ekler)
router.post("/accept-invite", authMiddleware, async (req, res) => {
  try {
    const { piggyBankId } = req.body;
    const userId = req.user.userId;

    if (!piggyBankId) {
      return res.status(400).json({ success: false, message: "Eksik bilgi" });
    }

    const PiggyBank = require("../models/PiggyBank");
    const ProfileInfo = require("../models/ProfileInfo");
    const Notification = require("../models/Notification");

    const piggyBank = await PiggyBank.findById(piggyBankId);
    if (!piggyBank) {
      return res.status(404).json({ success: false, message: "Kumbara bulunamadı" });
    }

    // ❌ Kullanıcı davetli değilse reddet
    if (!piggyBank.pendingInvites.includes(userId)) {
      return res.status(400).json({ success: false, message: "Bu kumbara için davet bulunamadı" });
    }

    // ✅ Katılımcı listelerine ekle
    piggyBank.pendingInvites = piggyBank.pendingInvites.filter(id => id.toString() !== userId);
    piggyBank.participants.push(userId);
    await piggyBank.save();

    // ✅ Kullanıcının kendi SubWallet'ını oluştur veya bul
    const ownerSubWallet = await SubWallet.findById(piggyBank.subWalletId);
    const type = ownerSubWallet ? ownerSubWallet.type : "shared";

    let userSubWallet = await SubWallet.findOne({ userId, type });
    if (!userSubWallet) {
      userSubWallet = new SubWallet({
        userId,
        type,
        participants: [userId],
        piggyBanks: [],
      });
      await userSubWallet.save();
    }

    // ✅ Kabul edilen kumbara'yı kullanıcının subWallet'ına da ekle
    if (!userSubWallet.piggyBanks.includes(piggyBank._id)) {
      userSubWallet.piggyBanks.push(piggyBank._id);
      await userSubWallet.save();
    }

    // 📨 Bildirim gönder
    const accepterProfile = await ProfileInfo.findOne({ userId });
    const accepterName = accepterProfile?.name || "Bir kullanıcı";

    await Notification.create({
      userId: piggyBank.owner,
      type: "piggybank_invite_accepted",
      amount: 0,
      description: `"${piggyBank.name}" adlı kumbaraya davet ettiğiniz ${accepterName} kullanıcısı davetinizi kabul etti.`,
      status: "completed",
    });

    return res.status(200).json({
      success: true,
      message: "Davet başarıyla kabul edildi",
    });
  } catch (err) {
    console.error("❌ Davet kabul hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});




// ✅ Kullanıcının bekleyen davetlerini getir
router.get("/pending", authMiddleware, async (req, res) => {
  try {
    const mongoose = require("mongoose");
    const userId = new mongoose.Types.ObjectId(req.user.userId); // 🔥 string → ObjectId

    // Kullanıcının davet edildiği tüm kumbaraları bul
    const pendingPiggyBanks = await PiggyBank.find({
      pendingInvites: userId
    })
      .populate("subWalletId", "type")
      .populate("owner", "phone inviteID")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      pendingInvites: pendingPiggyBanks.map(pb => ({
        _id: pb._id,
        name: pb.name,
        type: pb.subWalletId?.type,
        owner: pb.owner,
        createdAt: pb.createdAt,
      })),
    });
  } catch (err) {
    console.error("❌ Bekleyen davetleri getirme hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});




// 🚫 Daveti reddet
router.post("/decline-invite", authMiddleware, async (req, res) => {
  try {
    const { piggyBankId } = req.body;
    const userId = req.user.userId;

    if (!piggyBankId) {
      return res.status(400).json({ success: false, message: "Eksik bilgi" });
    }

    const piggyBank = await PiggyBank.findById(piggyBankId);
    if (!piggyBank) {
      return res.status(404).json({ success: false, message: "Kumbara bulunamadı" });
    }

    // Kullanıcı gerçekten davetli mi kontrol et
    if (!piggyBank.pendingInvites.includes(userId)) {
      return res.status(400).json({ success: false, message: "Bu kumbara için davet bulunamadı" });
    }

    // Pending listesinden çıkar
    piggyBank.pendingInvites = piggyBank.pendingInvites.filter(
      id => id.toString() !== userId
    );
    await piggyBank.save();

    // (İsteğe bağlı) Bildirim oluşturulabilir

    return res.status(200).json({
      success: true,
      message: "Davet reddedildi",
    });
  } catch (err) {
    console.error("❌ Davet reddetme hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});


  // 👥 Kumbara katılımcılarını getir
  router.get("/participants/:piggyBankId", authMiddleware, async (req, res) => {
    try {
      const { piggyBankId } = req.params;

      const piggyBank = await PiggyBank.findById(piggyBankId)
        .populate({
          path: "participants",
          select: "phone inviteID profileInfoId",
          populate: {
            path: "profileInfoId",
            select: "name avatar"
          }
        })
        .populate({
          path: "pendingInvites",
          select: "phone inviteID profileInfoId",
          populate: {
            path: "profileInfoId",
            select: "name avatar"
          }
        });

      if (!piggyBank) {
        return res.status(404).json({ success: false, message: "Kumbara bulunamadı" });
      }

      res.status(200).json({
        success: true,
        participants: piggyBank.participants,
        pendingInvites: piggyBank.pendingInvites,
      });
    } catch (err) {
      console.error("❌ Katılımcı listesi hatası:", err);
      res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
  });





// 🔍 Kullanıcıyı inviteID ile ara
router.get("/search-user/:inviteID", async (req, res) => {
  try {
    const { inviteID } = req.params;

    const User = require("../models/User");
    const ProfileInfo = require("../models/ProfileInfo");

    // Kullanıcıyı davet koduna göre bul
    const user = await User.findOne({ inviteID });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Kullanıcı bulunamadı",
      });
    }

    // Profil bilgisini al (isim gibi)
    const profile = await ProfileInfo.findOne({ userId: user._id });

    return res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        name: profile?.name || "İsimsiz Kullanıcı",
        phone: user.phone,
        inviteID: user.inviteID,
      },
    });
  } catch (err) {
    console.error("❌ search-user hatası:", err);
    res.status(500).json({
      success: false,
      message: "Sunucu hatası",
    });
  }
});


// ✅ Kullanıcının daha önce davet ettiği kullanıcıları getir (isim dahil)
router.get("/invited-users", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const User = require("../models/User");
    const ProfileInfo = require("../models/ProfileInfo");

    // Kullanıcının sahip olduğu tüm kumbaraları bul
    const myPiggyBanks = await PiggyBank.find({ owner: userId }).populate(
      "pendingInvites",
      "inviteID phone"
    );

    // Tüm davet edilen kullanıcıları topla (benzersiz)
    const invitedSet = new Set();
    const invitedUsers = [];

    for (const pb of myPiggyBanks) {
      for (const u of pb.pendingInvites) {
        if (!invitedSet.has(u._id.toString())) {
          invitedSet.add(u._id.toString());

          // 🔹 Kullanıcının profil adını çek
          const profile = await ProfileInfo.findOne({ userId: u._id });

          invitedUsers.push({
            _id: u._id,
            inviteID: u.inviteID,
            phone: u.phone,
            name: profile?.name || "İsimsiz Kullanıcı",
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      users: invitedUsers,
    });
  } catch (err) {
    console.error("❌ invited-users hatası:", err);
    return res.status(500).json({
      success: false,
      message: "Sunucu hatası",
    });
  }
});



// 🗑 Davet edilen kullanıcıyı kaldır
router.delete("/delete-invited/:userId", authMiddleware, async (req, res) => {
  try {
    const { userId: invitedUserId } = req.params;
    const ownerId = req.user.userId;

    // Kullanıcının sahip olduğu kumbaraları getir
    const myPiggyBanks = await PiggyBank.find({ owner: ownerId });

    let updatedCount = 0;
    for (const pb of myPiggyBanks) {
      const before = pb.pendingInvites.length;
      pb.pendingInvites = pb.pendingInvites.filter((id) => id.toString() !== invitedUserId);
      if (pb.pendingInvites.length !== before) {
        updatedCount++;
        await pb.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: updatedCount > 0 ? "Davet başarıyla silindi" : "Bu kullanıcı zaten listede değil",
    });
  } catch (err) {
    console.error("❌ delete-invited hatası:", err);
    return res.status(500).json({ success: false, message: "Sunucu hatası" });
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


// ✅ Belirli bir kumbara detayını getir
router.get("/detail/:piggyBankId", authMiddleware, async (req, res) => {
  try {
    const { piggyBankId } = req.params;

    // ObjectId kontrolü
    if (!mongoose.Types.ObjectId.isValid(piggyBankId)) {
      return res.status(400).json({ success: false, message: "Geçersiz kumbara ID" });
    }

    const piggyBank = await PiggyBank.findById(piggyBankId)
      .populate("subWalletId", "type")
      .populate({
        path: "participants",
        select: "phone inviteID profileInfoId",
        populate: {
          path: "profileInfoId",
          select: "name avatar",
        },
      })
      .populate({
        path: "owner",
        select: "phone inviteID profileInfoId",
        populate: {
          path: "profileInfoId",
          select: "name avatar",
        },
      });

    if (!piggyBank) {
      return res.status(404).json({ success: false, message: "Kumbara bulunamadı" });
    }

    return res.status(200).json({
      success: true,
      piggybank: piggyBank,
    });
  } catch (err) {
    console.error("❌ Kumbara detay hatası:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Kumbara içine para ekle (Wallet bakiyesi düşmeden)
router.post("/deposit", authMiddleware, async (req, res) => {
  try {
    const { piggyBankId, amount } = req.body;
    const userId = req.user.userId;

    if (!piggyBankId || !amount) {
      return res.status(400).json({ success: false, message: "Eksik bilgi" });
    }

    // 🎯 Kumbara kontrolü
    const piggyBank = await PiggyBank.findById(piggyBankId);
    if (!piggyBank) {
      return res.status(404).json({ success: false, message: "Kumbara bulunamadı" });
    }

    // 💰 Sadece kumbaraya ekleme yapılır, cüzdan bakiyesi değişmez
    piggyBank.currentAmount += amount;
    await piggyBank.save();

    // 🔹 Transaction kaydı oluştur
    const Transaction = require("../models/Transaction");
    await Transaction.create({
      userId,
      piggyBankId,
      piggyBankName: piggyBank.name,
      subWalletType: piggyBank.type || null,
      type: "piggybank_deposit",
      amount,
      description: `"${piggyBank.name}" kumbarasına ₺${amount} eklendi.`,
      status: "completed",
      createdAt: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: "Kumbaraya para başarıyla eklendi",
      piggyBank,
    });
  } catch (err) {
    console.error("❌ Kumbara deposit hatası:", err);
    return res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

// ✅ Kumbaradan cüzdana para çekme (Wallet bakiyesi değişmeden)
router.post("/withdraw", authMiddleware, async (req, res) => {
  try {
    const { piggyBankId, amount } = req.body;
    const userId = req.user.userId;

    if (!piggyBankId || !amount) {
      return res.status(400).json({ success: false, message: "Eksik bilgi" });
    }

    // 🎯 Kumbara kontrolü
    const piggyBank = await PiggyBank.findById(piggyBankId);
    if (!piggyBank) {
      return res.status(404).json({ success: false, message: "Kumbara bulunamadı" });
    }

    // 💰 Yetersiz bakiye kontrolü
    if (piggyBank.currentAmount < amount) {
      return res.status(400).json({ success: false, message: "Kumbarada yeterli bakiye yok" });
    }

    // 🔹 Kumbara bakiyesini azalt
    piggyBank.currentAmount -= amount;
    await piggyBank.save();

    // 🔹 Transaction kaydı oluştur
    const Transaction = require("../models/Transaction");
    await Transaction.create({
      userId,
      piggyBankId,
      piggyBankName: piggyBank.name,
      subWalletType: piggyBank.type || null,
      type: "piggybank_withdraw",
      amount,
      description: `"${piggyBank.name}" kumbarasından ₺${amount} çekildi.`,
      status: "completed",
      createdAt: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: "Kumbaradan para başarıyla çekildi",
      piggyBank,
    });
  } catch (err) {
    console.error("❌ Kumbara withdraw hatası:", err);
    return res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});


// 👨‍👩‍👧 Ebeveynin çocuğu için kumbara oluşturması
router.post("/child/:childId/create", authMiddleware, async (req, res) => {
  try {
    const { childId } = req.params;
    const { type, name, targetAmount, currentAmount, category, color } = req.body;
    const parentId = req.user.userId;

    if (!childId || !type || !name) {
      return res.status(400).json({ success: false, message: "Eksik bilgi gönderildi." });
    }

    const User = require("../models/User");
    const Notification = require("../models/Notification");
    const Transaction = require("../models/Transaction");
    const ProfileInfo = require("../models/ProfileInfo");

    // 🎯 Çocuk var mı kontrol et
    const child = await User.findById(childId);
    if (!child) {
      return res.status(404).json({ success: false, message: "Çocuk bulunamadı." });
    }

    // 🎯 Ebeveyn ilişkisi doğrula
    const isParentOfChild =
      child.parentIds?.map(id => id.toString()).includes(parentId.toString()) ||
      child.parentId?.toString() === parentId.toString();
    if (!isParentOfChild) {
      return res.status(403).json({ success: false, message: "Bu çocuk size ait değil." });
    }

    // 🎯 Çocuğun subWallet’ını bul veya oluştur
    let subWallet = await SubWallet.findOne({ userId: childId, type });
    if (!subWallet) {
      subWallet = new SubWallet({
        userId: childId,
        type,
        participants: [childId],
        piggyBanks: [],
      });
      await subWallet.save();
    }

    // 🎯 Kumbara oluştur
    const piggyBank = new PiggyBank({
      subWalletId: subWallet._id,
      name,
      targetAmount: type === "savings" ? targetAmount || 0 : 0,
      currentAmount: currentAmount || 0,
      category,
      color,
      participants: [childId],
      pendingInvites: [],
      owner: childId,
    });
    await piggyBank.save();

    // 🔹 SubWallet’a ekle
    subWallet.piggyBanks.push(piggyBank._id);
    await subWallet.save();

    // 🔹 Transaction kaydı oluştur (ebeveyn tarafından)
    await Transaction.create({
      userId: parentId,
      piggyBankId: piggyBank._id,
      piggyBankName: piggyBank.name,
      subWalletType: type,
      type: "piggybank_create_child",
      amount: piggyBank.currentAmount || 0,
      description: `Ebeveyn tarafından "${piggyBank.name}" adlı kumbara ${child.phone || "çocuk hesabı"} için oluşturuldu.`,
      status: "completed",
      createdAt: new Date(),
    });

    // 🔹 Çocuğa bildirim gönder
    const parentProfile = await ProfileInfo.findOne({ userId: parentId });
    const parentName = parentProfile?.name || "Ebeveyn";
    await Notification.create({
      userId: childId,
      type: "piggybank_create",
      description: `${parentName} senin için "${piggyBank.name}" adlı bir kumbara oluşturdu.`,
      status: "completed",
    });

    return res.status(201).json({
      success: true,
      message: "Çocuk için kumbara başarıyla oluşturuldu.",
      piggyBank,
    });
  } catch (err) {
    console.error("❌ Çocuk için kumbara oluşturma hatası:", err);
    return res.status(500).json({ success: false, message: "Sunucu hatası." });
  }
});

// ✅ Belirli bir çocuğun kumbaralarını getir
router.get("/child/:childId", authMiddleware, async (req, res) => {
  try {
    const { childId } = req.params;

    // 🎯 Çocuğun SubWallet'larını bul
    const subWallets = await SubWallet.find({ userId: childId });
    if (!subWallets.length) {
      return res.status(200).json({ success: true, piggyBanks: [] });
    }

    // 🎯 O SubWallet'lara bağlı kumbaraları getir
    const piggyBanks = await PiggyBank.find({
      subWalletId: { $in: subWallets.map(sw => sw._id) },
    })
      .populate("subWalletId", "type")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      piggyBanks,
    });
  } catch (err) {
    console.error("❌ Çocuk kumbaralarını getirme hatası:", err);
    return res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

// 💸 Ebeveyn → Çocuğun kumbarasına para gönderme (cüzdanlar da güncellenir)
router.post("/child/:childId/transfer", authMiddleware, async (req, res) => {
  try {
    const { childId } = req.params;
    const { piggyBankId, amount } = req.body;
    const parentId = req.user.userId;

    if (!childId || !piggyBankId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Eksik veya geçersiz bilgi gönderildi." });
    }

    const User = require("../models/User");
    const Wallet = require("../models/Wallet");
    const PiggyBank = require("../models/PiggyBank");
    const Notification = require("../models/Notification");
    const Transaction = require("../models/Transaction");
    const ProfileInfo = require("../models/ProfileInfo");

    // 🎯 Ebeveyn-çocuk ilişkisini doğrula
    const child = await User.findById(childId);
    if (!child) {
      return res.status(404).json({ success: false, message: "Çocuk bulunamadı." });
    }

    const isParentOfChild =
      child.parentIds?.map(id => id.toString()).includes(parentId.toString()) ||
      child.parentId?.toString() === parentId.toString();

    if (!isParentOfChild) {
      return res.status(403).json({ success: false, message: "Bu çocuk size ait değil." });
    }

    // 🎯 Cüzdan ve kumbara kontrolleri
    const parentWallet = await Wallet.findOne({ userId: parentId });
    const childWallet = await Wallet.findOne({ userId: childId });
    const piggyBank = await PiggyBank.findById(piggyBankId);

    if (!parentWallet || !childWallet || !piggyBank) {
      return res.status(404).json({ success: false, message: "Cüzdan veya kumbara bulunamadı." });
    }

    if (parentWallet.balance < amount) {
      return res.status(400).json({ success: false, message: "Ebeveyn bakiyesi yetersiz." });
    }

    // 💰 İşlem: ebeveyn cüzdanından düş, çocuğun cüzdanına ve kumbarasına ekle
    parentWallet.balance -= amount;
    childWallet.balance += amount;
    piggyBank.currentAmount += amount;

    await parentWallet.save();
    await childWallet.save();
    await piggyBank.save();

    // 🧾 Transaction kayıtları
    await Transaction.create({
      userId: parentId,
      piggyBankId,
      piggyBankName: piggyBank.name,
      subWalletType: piggyBank.type || null,
      type: "transfer",
      amount,
      description: `Ebeveyn olarak ${child.phone || "çocuğuna"} ₺${amount} gönderildi.`,
      status: "completed",
      createdAt: new Date(),
    });

    await Transaction.create({
      userId: childId,
      piggyBankId,
      piggyBankName: piggyBank.name,
      subWalletType: piggyBank.type || null,
      type: "piggybank_deposit",
      amount,
      description: `${parentId} tarafından "${piggyBank.name}" kumbarasına ₺${amount} gönderildi.`,
      status: "completed",
      createdAt: new Date(),
    });

    // 🔔 Bildirimler
    const parentProfile = await ProfileInfo.findOne({ userId: parentId });
    const parentName = parentProfile?.name || "Ebeveyn";

    await Notification.create({
      userId: parentId,
      type: "allowance_sent",
      amount,
      description: `${child.name || "çocuğuna"} ₺${amount} gönderildi.`,
      status: "completed",
    });

    await Notification.create({
      userId: childId,
      type: "piggybank_deposit",
      amount,
      description: `${parentName} kumbarana ₺${amount} ekledi.`,
      status: "completed",
    });

    return res.status(200).json({
      success: true,
      message: "Para başarıyla çocuğun kumbarasına gönderildi.",
      piggyBank,
      parentBalance: parentWallet.balance,
      childBalance: childWallet.balance,
    });
  } catch (err) {
    console.error("❌ Çocuğa transfer hatası:", err);
    return res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});




module.exports = router;
