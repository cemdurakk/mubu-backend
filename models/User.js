const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: false }, // doğrulamadan önce boş olabilir
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    pin: { type: String }, // 👈 Hashlenmiş PIN burada saklanacak


    // Kullanıcı durum alanları
    verified: { type: Boolean, default: false },         // SMS doğrulandı mı?
    pinCreated: { type: Boolean, default: false },       // 5 haneli şifre oluşturuldu mu?
    profileCompleted: { type: Boolean, default: false }, // Detaylı bilgiler girildi mi?
    firstLoginCompleted: { type: Boolean, default: false }, // İlk kez ana sayfaya girdi mi?

    // SMS doğrulama alanları
    verificationCode: { type: String },   // 6 haneli kod
    verificationExpires: { type: Date },  // kodun geçerlilik süresi (örn. 5 dk)

    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true } // otomatik olarak createdAt & updatedAt ekler
);

module.exports = mongoose.model("User", userSchema);
