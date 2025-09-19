// webhook.js
const express = require("express");
const router = express.Router();
//const axios = require("axios"); // opcional p/descargar media
const logger = require("../utils/logger");
// Opcional: usa tu logger si tenés (winston, pino, etc.)
const log = console;
const { sendTextMessage } = require("./sendMessage");
const { handleInboundMessage } = require("../services/messageHandler");
// ===== Helpers =====
function getContactName(value, from) {
  const contact = (value.contacts || []).find(c => c.wa_id === from) || value.contacts?.[0];
  return contact?.profile?.name || contact?.profile?.full_name || from;
}

function logStatus(st) {
  const { id, recipient_id, status, timestamp, errors, pricing, conversation } = st;
  log.info(`[STATUS] ${status} id=${id} to=${recipient_id} ts=${timestamp}` +
    (pricing ? ` price=${pricing.pricing_model}/${pricing.category}` : '') +
    (conversation ? ` conv=${conversation.id}/${conversation.origin?.type}` : ''));
  if (errors?.length) {
    errors.forEach(e => log.error(`[STATUS-ERROR] code=${e.code} title=${e.title} details=${e.error_data?.details || ''}`));
  }
}

function logMessage(value, msg) {
  const from = msg.from;
  const name = getContactName(value, from);
  const ctx = msg.context ? ` (reply_to=${msg.context?.id || ''})` : '';

  switch (msg.type) {
    case "text":
      log.info(`[TEXT] ${name} <${from}>: ${msg.text?.body}${ctx}`);
      break;

    case "location":
      log.info(`[LOCATION] ${name} <${from}> lat=${msg.location?.latitude} lon=${msg.location?.longitude} name="${msg.location?.name || ''}" address="${msg.location?.address || ''}"${ctx}`);
      break;

    case "image":
      log.info(`[IMAGE] ${name} <${from}> media_id=${msg.image?.id} mime=${msg.image?.mime_type} caption="${msg.image?.caption || ''}" sha256=${msg.image?.sha256}${ctx}`);
      break;

    case "audio":
      log.info(`[AUDIO] ${name} <${from}> media_id=${msg.audio?.id} voice=${msg.audio?.voice || false} mime=${msg.audio?.mime_type} sha256=${msg.audio?.sha256}${ctx}`);
      break;

    case "document":
      log.info(`[DOCUMENT] ${name} <${from}> media_id=${msg.document?.id} filename="${msg.document?.filename || ''}" mime=${msg.document?.mime_type} sha256=${msg.document?.sha256}${ctx}`);
      break;

    case "video":
      log.info(`[VIDEO] ${name} <${from}> media_id=${msg.video?.id} mime=${msg.video?.mime_type} caption="${msg.video?.caption || ''}" sha256=${msg.video?.sha256}${ctx}`);
      break;

    case "sticker":
      log.info(`[STICKER] ${name} <${from}> media_id=${msg.sticker?.id} animated=${msg.sticker?.animated}${ctx}`);
      break;

    case "contacts":
      const c = msg.contacts?.[0];
      const cName = c?.name ? `${c.name.first_name || ''} ${c.name.last_name || ''}`.trim() : '';
      const cPhone = c?.phones?.[0]?.wa_id || c?.phones?.[0]?.phone;
      log.info(`[CONTACT] ${name} <${from}> shared name="${cName}" phone="${cPhone || ''}"${ctx}`);
      break;

    case "reaction":
      log.info(`[REACTION] ${name} <${from}> reacted "${msg.reaction?.emoji}" to=${msg.reaction?.message_id}${ctx}`);
      break;

    case "interactive":
      if (msg.interactive?.type === "button_reply") {
        log.info(`[INTERACTIVE:BUTTON] ${name} <${from}> title="${msg.interactive.button_reply?.title}" id="${msg.interactive.button_reply?.id}"${ctx}`);
      } else if (msg.interactive?.type === "list_reply") {
        log.info(`[INTERACTIVE:LIST] ${name} <${from}> title="${msg.interactive.list_reply?.title}" id="${msg.interactive.list_reply?.id}"${ctx}`);
      } else {
        log.info(`[INTERACTIVE] ${name} <${from}> ${JSON.stringify(msg.interactive)}${ctx}`);
      }
      break;

    // Compat: algunos entornos viejos devuelven "button" (en vez de interactive)
    case "button":
      log.info(`[BUTTON] ${name} <${from}> text="${msg.button?.text}" payload="${msg.button?.payload}"${ctx}`);
      break;

    // Por si Meta agrega tipos nuevos:
    default:
      log.info(`[UNKNOWN:${msg.type}] ${name} <${from}> raw=${JSON.stringify(msg)}`);
      break;
  }
}

// ===== Opcional: descargar media (si querés guardar archivo) =====
// Requiere process.env.WHATSAPP_TOKEN y axios
async function getMediaUrl(mediaId) {
  const v = process.env.WHATSAPP_API_VERSION || "v23.0";
  const token = process.env.WHATSAPP_TOKEN;
  const { data } = await axios.get(`https://graph.facebook.com/${v}/${mediaId}`, {
    params: { access_token: token }
  });
  return data.url; // URL temporal
}

async function downloadMediaToFile(mediaId, outPath) {
  const url = await getMediaUrl(mediaId);
  const token = process.env.WHATSAPP_TOKEN;
  const resp = await axios.get(url, {
    responseType: "stream",
    headers: { Authorization: `Bearer ${token}` }
  });
  await new Promise((resolve, reject) => {
    const fs = require("fs");
    const w = fs.createWriteStream(outPath);
    resp.data.pipe(w);
    w.on("finish", resolve);
    w.on("error", reject);
  });
  return outPath;
}

// ===== POST /webhook =====
router.post("/webhook", async (req, res) => {
  try {
    //console.log("Webhook recibido:", JSON.stringify(req.body, null, 2));
    const body = req.body;

    if (!body?.entry) {
      //console.warn("Webhook recibido sin 'entry'");
      return res.sendStatus(200);
    }

    const idnumber = 775888798944971;

    body.entry.forEach(entry => {
      (entry.changes || []).forEach(change => {
        const value = change.value || {};
        const messages = value.messages || [];
        const statuses = value.statuses || [];

        // Procesar mensajes
        messages.forEach(msg => {
          try {
            logMessage(value, msg);
            const from = msg.from;
            const name = getContactName(value, from);
            const reply = `Hola ${name} (${from})! Recibimos tu mensaje: "${msg.text.body}"`;

            //sendTextMessage(from, reply, idnumber);
          } catch (e) {
            log.error("Error handling message:", e);
          }
        });

        // Procesar estados
        statuses.forEach(st => {
          try {
            logStatus(st);
          } catch (e) {
            log.error("Error handling status:", e);
          }
        });
      });
    });
for (const entry of body.entry) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const messages = value.messages || [];

        for (const msg of messages) {
          try {
            await handleInboundMessage(msg, value);
          } catch (e) {
            console.error("Error procesando mensaje:", e);
            logger.error(`❌ Error procesando mensaje de ${msg.from}: ${e.message}`);
          }
        }
      }
    }
    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook handler error:", err);
    logger.error(`❌ Error procesando mensaje de ${msg.from}: ${err.message}`);
    res.sendStatus(200);
  }
});


router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("🔍 Verificación recibida:");
  console.log("Mode:", mode);
  console.log("Token:", token);
  console.log("Challenge:", challenge);

  if (mode === "subscribe" && token === "cale324fones") {
    console.log("✅ Verificación exitosa");
    res.status(200).send(challenge);
  } else {
    console.warn("❌ Verificación fallida");
    res.sendStatus(403);
  }
});

module.exports = router;
