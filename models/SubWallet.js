const mongoose = require("mongoose");

const SubWalletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Alt cüzdan tipi: bireysel / ortak / birikim
    type: {
      type: String,
      enum: ["individual", "shared", "savings"], // bireysel, ortak, birikim
      required: true,
    },

    // Katılımcılar → bireysel / ortak / birikim fark etmez,
    // tüm subWallet türlerinde array olacak.
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Bu alt cüzdan altındaki kumbaralar
    piggyBanks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PiggyBank",
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

module.exports = mongoose.model("SubWallet", SubWalletSchema);
