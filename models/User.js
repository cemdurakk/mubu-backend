// 📂 models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // 👤 Temel bilgiler
    name: { type: String, required: false },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    pin: { type: String },

    // 🔐 Güvenlik bilgileri
    securityQuestion: { type: String, required: false },
    securityAnswer: { type: String, required: false },

    // 🧩 Kullanıcı rolü
    role: {
      type: String,
      enum: ["individual", "parent", "child"],
      default: "individual",
    },

    // 👨‍👩‍👧 Parent–Child ilişkileri
    parentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] }],
    children: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] }],

    // 💍 Eş ilişkisi
    wife_husband: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // 📩 Eş davetleri (gelen)
    pendingSpouseInvites: [
      {
        from: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // 📤 Gönderilen eş davetleri
    sentSpouseInvites: [
      {
        to: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // 🪙 Ebeveyn paketi – abonelik bilgileri
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParentSubscription",
      default: null,
    },
    subscriptionActive: { type: Boolean, default: false },
    subscriptionExpiresAt: { type: Date, default: null },

    // 💰 Harçlık geçmişi
    allowanceHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: "Notification" }],

    // 🟣 Görev sistemi
    activeTasks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
        default: [],
      },
    ],

    // 🔵 Kullanıcı durum alanları
    verified: { type: Boolean, default: false },
    pinCreated: { type: Boolean, default: false },
    profileCompleted: { type: Boolean, default: false },
    firstLoginCompleted: { type: Boolean, default: false },
    deviceId: { type: String, default: null },

    // 📛 Davet kodu
    inviteID: { type: String, unique: true },

    // 👤 Profil referansı
    profileInfoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProfileInfo",
      default: null,
    },

    // 🔢 SMS doğrulama
    verificationCode: { type: String },
    verificationExpires: { type: Date },

    // 🕓 Kayıt tarihi
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
