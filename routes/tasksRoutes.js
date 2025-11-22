// 📂 routes/taskRoutes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");
const Task = require("../models/Task");
const Wallet = require("../models/Wallet");
const Notification = require("../models/Notification");


/**
 * 🟣 1) EBEVEYN → ÇOCUĞA GÖREV OLUŞTURUR
 * POST /api/tasks/create
 */
router.post("/create", authMiddleware, async (req, res) => {
  try {
    const parentId = req.user.userId;
    const { childId, title, description, rewardAmount } = req.body;

    if (!childId || !title) {
      return res.status(400).json({
        success: false,
        message: "childId ve title zorunludur.",
      });
    }

    const parent = await User.findById(parentId);
    if (!parent || parent.role !== "parent") {
      return res.status(403).json({
        success: false,
        message: "Bu işlem sadece ebeveyn hesabı ile yapılabilir.",
      });
    }

    const child = await User.findById(childId);
    if (!child || child.role !== "child") {
      return res.status(400).json({
        success: false,
        message: "Geçersiz childId.",
      });
    }

    // 🎯 Görev oluşturulur (default status = pending)
    const task = new Task({
      parentId,
      childId,
      title,
      description,
      rewardAmount,
      status: "pending",
    });

    await task.save();

    return res.json({
      success: true,
      message: "Görev oluşturuldu.",
      task,
    });

  } catch (err) {
    console.error("❌ Görev oluşturma hatası:", err);
    return res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});



/**
 * 🟡 2) ÇOCUĞUN AKTİF GÖREVLERİ (pending olanlar)
 * GET /api/tasks/child/active
 */
router.get("/child/active", authMiddleware, async (req, res) => {
  try {
    const childId = req.user.userId;

    const child = await User.findById(childId);
    if (!child || child.role !== "child") {
      return res.status(403).json({
        success: false,
        message: "Bu işlem sadece çocuk kullanıcılar içindir.",
      });
    }

    const tasks = await Task.find({
      childId,
      status: "pending",
    }).sort({ createdAt: -1 });

    return res.json({ success: true, tasks });

  } catch (err) {
    console.error("❌ Aktif görev hata:", err);
    return res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});



/**
 * 🟢 3) ÇOCUK GÖREVİ TAMAMLADI OLARAK İŞARETLER
 * POST /api/tasks/child/complete
 */
router.post("/child/complete", authMiddleware, async (req, res) => {
  try {
    const childId = req.user.userId;
    const { taskId } = req.body;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: "taskId zorunludur.",
      });
    }

    const child = await User.findById(childId);
    if (!child || child.role !== "child") {
      return res.status(403).json({
        success: false,
        message: "Bu işlem sadece çocuk içindir.",
      });
    }

    const task = await Task.findOne({ _id: taskId, childId });
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Görev bulunamadı.",
      });
    }

    task.status = "completed";
    task.completedAt = new Date();
    await task.save();

    return res.json({
      success: true,
      message: "Görev tamamlandı olarak işaretlendi.",
    });

  } catch (err) {
    console.error("❌ Görev tamamlama hatası:", err);
    return res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});



/**
 * 🔵 4) EBEVEYN → ÇOCUĞUN GÖREVİNİ ONAYLAR (ÖDÜL ÖDER)
 * POST /api/tasks/approve
 */
router.post("/approve", authMiddleware, async (req, res) => {
  try {
    const parentId = req.user.userId;
    const { taskId } = req.body;

    const parent = await User.findById(parentId);
    if (!parent || parent.role !== "parent") {
      return res.status(403).json({ success: false, message: "Bu işlem sadece ebeveyn içindir." });
    }

    const task = await Task.findOne({ _id: taskId, parentId });
    if (!task) {
      return res.status(404).json({ success: false, message: "Görev bulunamadı." });
    }

    if (task.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "Görev henüz çocuk tarafından tamamlanmadı.",
      });
    }

    // 🪙 Parent cüzdan → Child cüzdan para aktarma
    const parentWallet = await Wallet.findOne({ userId: parentId });
    const childWallet = await Wallet.findOne({ userId: task.childId });

    if (!parentWallet || parentWallet.balance < task.rewardAmount) {
      return res.status(400).json({
        success: false,
        message: "Bakiyeniz bu ödülü göndermek için yeterli değil.",
      });
    }

    parentWallet.balance -= task.rewardAmount;
    childWallet.balance += task.rewardAmount;

    await parentWallet.save();
    await childWallet.save();

    // 🔔 Bildirim
    await Notification.create({
      userId: task.childId,
      type: "allowance_sent",
      amount: task.rewardAmount,
      from: parentId,
      description: `${parent.name} tarafından görev ödülü gönderildi.`,
    });

    task.status = "approved";
    await task.save();

    return res.json({
      success: true,
      message: "Görev onaylandı, ödül gönderildi.",
    });

  } catch (err) {
    console.error("❌ Görev onay hata:", err);
    return res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});



/**
 * 🔴 5) EBEVEYN → GÖREVİ REDDEDER
 * POST /api/tasks/reject
 */
router.post("/reject", authMiddleware, async (req, res) => {
  try {
    const parentId = req.user.userId;
    const { taskId, reason } = req.body;

    const parent = await User.findById(parentId);
    if (!parent || parent.role !== "parent") {
      return res.status(403).json({ success: false, message: "Bu işlem sadece ebeveyn içindir." });
    }

    const task = await Task.findOne({ _id: taskId, parentId });
    if (!task) {
      return res.status(404).json({ success: false, message: "Görev bulunamadı." });
    }

    task.status = "rejected";
    await task.save();

    // 🔔 Bildirim
    await Notification.create({
      userId: task.childId,
      type: "task_rejected",
      from: parentId,
      description: reason || "Görev ebeveyn tarafından reddedildi.",
    });

    return res.json({
      success: true,
      message: "Görev reddedildi.",
    });

  } catch (err) {
    console.error("❌ Görev reddetme hatası:", err);
    return res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});



module.exports = router;
