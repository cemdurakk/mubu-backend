const twilio = require("twilio");

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function sendSms(to, message) {
  try {
    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER, // Twilio'dan aldığın numara
      to: to,
    });

    return { success: true, sid: result.sid };
  } catch (error) {
    console.error("SMS Gönderim Hatası:", error);
    return { success: false, error: error.message };
  }
}

module.exports = { sendSms };
