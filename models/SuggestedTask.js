// 📂 models/SuggestedTask.js
const mongoose = require("mongoose");

const suggestedTaskSchema = new mongoose.Schema(
  {
    // 📚 Görev kategorisi
    category: {
      type: String,
      enum: [
        "Ev işleri",        // örn: bulaşıkları yıka, odanı topla
        "Ödev",             // örn: kitap oku, matematik çalış
        "Uyku",             // örn: erken uyu
        "Spor",             // örn: sabah koşusu, egzersiz yap
        "Ders",             // örn: tarih konusunu tekrar et
        "Kişisel bakım",    // örn: diş fırçala, tırnak kes
        "Hayvan bakımı",    // örn: evcil hayvana mama ver
        "Aile zamanı",      // örn: aileyle film izle
        "Yardım",           // örn: çöpleri çıkar, sofrayı kur
        "Sosyal",           // 🆕 arkadaşlarla paylaşım, iletişim görevleri
      ],
      required: true,
    },

    // 📝 Görev başlığı
    title: { type: String, required: true, trim: true },

    // 💬 Açıklama (isteğe bağlı)
    description: { type: String, default: "", trim: true },

    // 💰 Önerilen ödül miktarı (₺)
    rewardAmount: {
      type: Number,
      default: 10,
      min: 0,
    },

    // 🟢 Aktif mi?
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// 🔍 Kategori + başlık kombinasyonunu benzersiz yapalım (duplicate olmasın)
suggestedTaskSchema.index({ category: 1, title: 1 }, { unique: true });

module.exports = mongoose.model("SuggestedTask", suggestedTaskSchema);
