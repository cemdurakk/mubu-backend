const mongoose = require("mongoose");

const PiggyBankSchema = new mongoose.Schema(
  {
    // Hangi alt cüzdana bağlı
    subWalletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubWallet",
      required: true,
    },

    // Kumbara adı
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Hedef tutar (kullanıcı belirler)
    targetAmount: {
      type: Number,
      default: 0,
    },

    // Şu anki biriken miktar
    currentAmount: {
      type: Number,
      default: 0,
    },

    // Kategori (değişken, kullanıcı veya sistemden seçilecek)
    category: {
      type: String,
      default: null,
    },

    // Renk kodu (ör: #FF5733 veya hazır renk isimleri)
    color: {
      type: String,
      default: "#7E57C2", // mor default olabilir
    },

    // Katılımcılar (özellikle ortak & birikim için)
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Davet edilen ama henüz kabul etmemiş kullanıcılar
    invitations: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("PiggyBank", PiggyBankSchema);
