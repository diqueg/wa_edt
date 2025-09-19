const { fetch } = require("undici");
const logger = require("../utils/logger");
require('dotenv').config();
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

// log y validación temprana
logger.info(`ENV CHECK: WHATSAPP_API_URL=${WHATSAPP_API_URL ? '[set]' : '[undefined]'} WHATSAPP_TOKEN=${WHATSAPP_TOKEN ? '[set]' : '[undefined]'}`);

if (!WHATSAPP_API_URL) {
  // falla temprana y legible para no llegar a undici
  throw new Error("WHATSAPP_API_URL no definida en process.env. Revisá .env o la configuración del proceso.");
}
if (!WHATSAPP_TOKEN) {
  throw new Error("WHATSAPP_TOKEN no definida en process.env. Revisá .env o la configuración del proceso.");
}

async function sendReply(waId, text, opts = {}) {
  const body = {
    messaging_product: "whatsapp",
    to: waId,
    type: "text",
    text: { body: text }
  };

  if (opts.payload) Object.assign(body, opts.payload);

  try {
    const res = await fetch(WHATSAPP_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const json = await res.json();
    if (!res.ok) {
      logger.error(`sendReply failed for ${waId}: ${res.status} ${JSON.stringify(json)}`);
      throw new Error("WhatsApp API error");
    }
    logger.info(`Mensaje enviado a ${waId} id:${json.messages?.[0]?.id || "n/a"}`);
    return json;
  } catch (err) {
    logger.error(`Error enviando mensaje a ${waId}: ${err.message}`);
    throw err;
  }
}

module.exports = { sendReply };
