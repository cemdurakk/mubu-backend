// 📂 models/Task.js
const mongoose = require("mongoose");
const moment = require("moment-timezone");

const taskSchema = new mongoose.Schema(
  {
    // 🧑‍🦱 Görevi oluşturan ebeveyn
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // 👶 Görev atanan çocuk
    childId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // 📌 Görev başlığı
    title: { type: String, required: true },

    // 💬 Görev açıklaması (örnek: “Odasını topla, yatağını düzelt”)
    description: { type: String, default: "" },

    // 💰 Görev için belirlenen ödül tutarı
    rewardAmount: { type: Number, default: 0 },

    // 📆 Görev durumu (çocuk tamamlayınca "completed" olacak)
    status: {
      type: String,
      enum: ["pending", "completed", "approved", "rejected"], // ✅ geleceğe dönük
      default: "pending",
    },

    // 📅 Görevin oluşturulma tarihi (TR saatine göre)
    createdAt: {
      type: Date,
      default: () => moment().tz("Europe/Istanbul").toDate(),
    },

    // 🕓 Görev tamamlanma zamanı
    completedAt: { type: Date, default: null },

    // 🔗 Bildirim ilişkisi (opsiyonel, görev oluşturulduğunda eklenebilir)
    notificationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notification",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", taskSchema);
