const mongoose = require("mongoose");

const profileInfoSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // users koleksiyonuna referans
      required: true,
      unique: true, // her kullanıcı için 1 profil
    },
    name: { type: String, required: true },
    dob: { type: String }, // doğum tarihi (dd.mm.yyyy formatı olabilir)
    tcNo: { type: String },
    email: { type: String },
    city: { type: String },
    district: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProfileInfo", profileInfoSchema);
