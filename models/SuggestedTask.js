const mongoose = require("mongoose");

const suggestedTaskSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: [
        "Ev işleri",       // örn: bulaşıkları yıka, odanı topla
        "Ödev",            // örn: kitap oku, matematik çalış
        "Uyku",            // örn: erken uyu
        "Spor",            // örn: sabah koşusu, egzersiz yap
        "Ders",            // örn: tarih konusunu tekrar et
        "Kişisel bakım",   // örn: diş fırçala, tırnak kes
        "Hayvan bakımı",   // örn: evcil hayvana mama ver
        "Aile zamanı",     // örn: aileyle film izle
        "Yardım",          // örn: çöpleri çıkar, sofrayı kur
      ],
      required: true,
    },

    title: { type: String, required: true },
    description: { type: String, default: "" },

    rewardAmount: {
      type: Number,
      default: 10, // önerilen ödül miktarı (₺)
      min: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SuggestedTask", suggestedTaskSchema);
    