const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: false }, // doğrulamadan önce boş olabilir
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    pin: { type: String }, // 👈 Hashlenmiş PIN burada saklanacak

    // Güvenlik sorusu
    securityQuestion: { type: String, required: false }, // sabit listeden seçilecek
    securityAnswer: { type: String, required: false },   // bcrypt ile hashlenmiş cevap

    // Kullanıcı rolü
    role: {
      type: String,
      enum: ["individual", "parent", "child"],
      default: "individual"
    },

    // Parent – Child ilişkisi
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, 
    children: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], 

    // Kullanıcı durum alanları
    verified: { type: Boolean, default: false },         // SMS doğrulandı mı?
    pinCreated: { type: Boolean, default: false },       // 5 haneli şifre oluşturuldu mu?
    profileCompleted: { type: Boolean, default: false }, // Detaylı bilgiler girildi mi?
    firstLoginCompleted: { type: Boolean, default: false }, // İlk kez ana sayfaya girdi mi?
    deviceId: { type: String, default: null },           // Kullanıcının kayıtlı cihaz kimliği

    // Abonelik (ebeveyn paketi için)
    subscriptionActive: { type: Boolean, default: false }, 

    // SMS doğrulama alanları
    verificationCode: { type: String },
    verificationExpires: { type: Date },

    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true } // otomatik createdAt & updatedAt ekler
);

module.exports = mongoose.model("User", userSchema);
