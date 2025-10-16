const mongoose = require("mongoose");
const User = require("../models/User");
const ProfileInfo = require("../models/ProfileInfo");
require("dotenv").config();

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ MongoDB bağlantısı başarılı");

    const users = await User.find();
    for (const user of users) {
      if (!user.profileInfoId) {
        const profile = await ProfileInfo.findOne({ userId: user._id });
        if (profile) {
          user.profileInfoId = profile._id;
          await user.save();
          console.log(`🔗 ${user.phone} için profil bağlantısı kuruldu`);
        }
      }
    }

    console.log("🎯 Tüm bağlantılar güncellendi");
    mongoose.connection.close();
  })
  .catch(err => {
    console.error("❌ Mongo bağlantı hatası:", err);
  });
