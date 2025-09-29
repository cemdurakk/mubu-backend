const mongoose = require("mongoose");

const SubWalletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Alt cüzdan tipi
    type: {
      type: String,
      enum: ["individual", "shared", "savings"], // bireysel, ortak, birikim
      required: true,
    },

    // Katılımcılar
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

    // Davet edilen kullanıcılar
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
