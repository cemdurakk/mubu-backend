const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: false },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    pin: { type: String },

    // Güvenlik sorusu
    securityQuestion: { type: String, required: false },
    securityAnswer: { type: String, required: false },

    // Kullanıcı rolü
    role: {
      type: String,
      enum: ["individual", "parent", "child"],
      default: "individual",
    },

    /**
     * 👨‍👩‍👧 Parent–Child ilişkisi
     * Artık çocuklar birden fazla ebeveyne bağlı olabilir.
     */
    parentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] }],
    children: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] }],

    // 👩‍❤️‍👨 Eş ilişkisi
    wife_husband: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // 📩 Eş davetleri (bu kullanıcıya gelen davetler)
    pendingSpouseInvites: [
      {
        from: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // 📤 Kullanıcının gönderdiği eş davetleri
    sentSpouseInvites: [
      {
        to: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // 👑 Ebeveyn paketi (abonelik) bağlantısı
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParentSubscription",
      default: null,
    },

    // Abonelik durumu
    subscriptionActive: { type: Boolean, default: false },
    subscriptionExpiresAt: { type: Date, default: null },
    allowanceHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: "Notification" }],


    // Kullanıcı durum alanları
    verified: { type: Boolean, default: false },
    pinCreated: { type: Boolean, default: false },
    profileCompleted: { type: Boolean, default: false },
    firstLoginCompleted: { type: Boolean, default: false },
    deviceId: { type: String, default: null },

    // Davet kodu (örnek: MUBU12345)
    inviteID: { type: String, unique: true },

    profileInfoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProfileInfo",
      default: null,
    },

    // SMS doğrulama alanları
    verificationCode: { type: String },
    verificationExpires: { type: Date },

    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
