// 📂 models/Task.js
const mongoose = require("mongoose");
const moment = require("moment-timezone");

const taskSchema = new mongoose.Schema(
  {
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    childId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    title: { type: String, required: true },
    description: { type: String, default: "" },
    rewardAmount: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    },

    createdAt: {
      type: Date,
      default: () => moment().tz("Europe/Istanbul").toDate(),
    },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", taskSchema);
