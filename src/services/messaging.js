const { fetch } = require("undici");
const logger = require("../utils/logger");
require('dotenv').config();
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const { sendReply } = require('../utils/sendMessage'); // tu sendReply existente
// log y validación temprana
//logger.info(`ENV CHECK: WHATSAPP_API_URL=${WHATSAPP_API_URL ? '[set]' : '[undefined]'} WHATSAPP_TOKEN=${WHATSAPP_TOKEN ? '[set]' : '[undefined]'}`);

if (!WHATSAPP_API_URL) {
  // falla temprana y legible para no llegar a undici
  throw new Error("WHATSAPP_API_URL no definida en process.env. Revisá .env o la configuración del proceso.");
}
if (!WHATSAPP_TOKEN) {
  throw new Error("WHATSAPP_TOKEN no definida en process.env. Revisá .env o la configuración del proceso.");
}

async function sendAndLogReply({ messageId, waId, replyText, phoneNumberId }) {
  const replyId = messageId ? `${messageId}:r1` : `r-${Date.now()}-${Math.floor(Math.random()*1000)}`;

  // 1) insertar PENDING (no falla si ya existió)
  await insertReplyLog({
    ReplyId: replyId,
    MessageId: messageId || null,
    WaId: waId,
    ReplyText: replyText,
    PhoneNumberId: phoneNumberId || null,
    Status: 'PENDING'
  });

  // 2) llamar a sendReply (transport) — mantiene tu función original
  try {
    const result = await sendReply(waId, replyText); // asumiendo devuelve objeto o lanza error
    // 3) actualizar registro a SENT con resultado
    await updateReplyLogStatus({
      ReplyId: replyId,
      Status: 'SENT',
      TransportResult: result,
      ErrorMessage: null
    });
    logger.info(`Reply sent and logged ReplyId=${replyId} WaId=${waId}`);
    return { ok: true, replyId, result };
  } catch (err) {
    // 4) actualizar registro a FAILED y propagar
    await updateReplyLogStatus({
      ReplyId: replyId,
      Status: 'FAILED',
      TransportResult: null,
      ErrorMessage: err.message
    });
    logger.error(`sendAndLogReply failed ReplyId=${replyId} -> ${err.message}`);
    throw err;
  }
}

module.exports = { sendAndLogReply };