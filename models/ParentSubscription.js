const mongoose = require("mongoose");

/**
 * 🎯 ParentSubscription Model
 * 
 * Bu model, ebeveyn paketinin detaylarını tutar:
 * - Kim aldı (userId)
 * - Eşi kim (spouseId)
 * - Çocukları kimler (children)
 * - Başlangıç ve bitiş tarihleri (startDate / endDate)
 * - Abonelik aktif mi (isActive)
 */

const ParentSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // paketi kim aldı
    },
    spouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // eşi davet edildiyse burada tutulacak
    },
    children: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // çocuğun userId’si
      },
    ],
    startDate: {
      type: Date,
      default: Date.now, // paket alındığı tarih
    },
    endDate: {
      type: Date,
      default: function () {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1); // 1 yıl sonrasını ayarlıyoruz
        return d;
      },
    },
    isActive: {
      type: Boolean,
      default: true, // 1 yıl dolana kadar aktif
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ParentSubscription", ParentSubscriptionSchema);
