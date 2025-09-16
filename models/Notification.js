const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Bildirimin sahibi

    type: { 
      type: String, 
      enum: ["transaction", "piggybank", "system"], // işlem, kumbara, sistem mesajı
      required: true 
    },

    title: { type: String, required: true },   // Kısa başlık (örn: "Para Yatırma Başarılı")
    message: { type: String, required: true }, // Detaylı açıklama

    relatedId: { type: mongoose.Schema.Types.ObjectId, default: null }, 
    // İlgili işlem veya kumbara (örn: TransactionId veya PiggyBankId)

    isRead: { type: Boolean, default: false }, // Kullanıcı gördü mü?
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
