const fetch = global.fetch || require("node-fetch");
require("dotenv").config();


const { WHATSAPP_TOKEN, API_VERSION } = process.env;

async function sendTextMessage(to, body, phoneNumberId) {
  try {
    const url = `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`;
    console.log("🔐 Token usado:", `"${WHATSAPP_TOKEN}"`);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body }
      })
    });

    const data = await res.json();
    console.log("✅ Respuesta API:", data);
    return data;
  } catch (err) {
    console.error("❌ Error enviando mensaje:", err);
    throw err;
  }
}

module.exports = { sendTextMessage };
