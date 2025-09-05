const express = require("express");
const router = express.Router();
const { sendSms } = require("../services/smsService");

router.post("/send", async (req, res) => {
  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({
      success: false,
      error: "Telefon numarası ve mesaj gerekli.",
    });
  }

  const result = await sendSms(to, message);
  res.json(result);
});

module.exports = router;
