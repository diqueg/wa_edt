// const { getSession, updateSessionState, saveName } = require("../db/session");
// const { insertMessageLog } = require("../db/messageLog");
// const { insertReplyLog } = require("../db/replyLog");
// const { isGreeting, isLikelyAddress } = require("../utils/analyzeMessage");
// const { sendTextMessage } = require("../utils/sendMessage");
// const { updateSessionData } = require("../db/session");

// const logger = require("../utils/logger");

//const { getFrequentAddresses } = require("../db/address");

// --- imports al inicio del archivo (ajustá rutas según tu proyecto)
const { getFrequentAddresses, saveAddress } = require("../db/address");
const { insertMessageLog } = require("../db/messageLog");
const { normalizeAddress, normalizeLocationToAddress } = require("../services/normalizer");
const { getSession, ensureSession, updateSessionState, updateSessionData, markSessionMessage, markMessageProcessing } = require("../db/session");
const logger = require("../utils/logger");
const { sendAndLogReply } = require("../services/messaging");

// --- helper
function isLikelyAddress(text) {
  if (!text || typeof text !== "string") return false;
  const t = text.trim();
  if (t.length === 0) return false;
  // patrones adaptables: calle/av/entre/numero/coma
  const streetWords = /\b(calle|av|avenida|avda|entre|pje|pasaje|plaza|b°|barrio|alameda|roca|mitre)\b/i;
  const hasNumber = /\d{1,5}/.test(t);
  const hasStreetWord = streetWords.test(t);
  // si es solo número corto (1 o 2 dígitos) probablemente sea selección
  if (/^\d+$/.test(t) && t.length <= 2) return false;
  return hasNumber || hasStreetWord || t.includes(",");
}

// helpers locales
function extractText(msg) {
  if (typeof msg.text === "string") return msg.text.trim();
  if (msg.text && typeof msg.text.body === "string") return msg.text.body.trim();
  if (msg.message && msg.message.text && typeof msg.message.text.body === "string")
    return msg.message.text.body.trim();
  if (msg.button && typeof msg.button.payload === "string") return msg.button.payload.trim();
  if (msg.list_reply && typeof msg.list_reply.id === "string") return msg.list_reply.id.trim();
  if (msg.interactive && msg.interactive.type === "button_reply" && typeof msg.interactive.button_reply?.id === "string")
    return msg.interactive.button_reply.id.trim();
  if (msg.interactive && msg.interactive.type === "list_reply" && typeof msg.interactive.list_reply?.id === "string")
    return msg.interactive.list_reply.id.trim();
  return "";
}


// --- handler (sólo el switch completo o parcial donde están los casos)
async function handleInboundMessage(msg) {
  const waId = msg.from;
  const text = extractText(msg);
  const messageId = msg.id || msg.messageId || msg.stanzaId;
  
  // 1) dedupe (una sola vez)
  const ok = messageId ? await markMessageProcessing(messageId, waId) : true;
  if (!ok) {
    logger.info(`Skipping duplicate message ${messageId} from ${waId}`);
    return;
  }
  
  // 2) registrar incoming (usa tu insertMessageLog)
  await insertMessageLog({
    WaId: waId,
    TipoMensaje: "incoming",
    Contenido: text || null,
    Timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
    Metadata: { messageId, raw: msg }
  });
  logger.info(`Mensage logged ${messageId} for ${waId}`);
  let session = await getSession(waId);
  // Si no existe sesión: crear/upsert y pedir el nombre
  if (!session) {
    // upsert y obtener la fila resultante (asegurate que updateSessionState retorne la fila)
    const row = await updateSessionState(waId, "AWAITING_NAME");
    session = row || { EstadoConversacional: "AWAITING_NAME", Datos: "{}" };

    // enviar prompt para pedir nombre y terminar el procesamiento de este mensaje
    const welcome = "¡Hola! Para comenzar, Me dirias tu nombre.";
    await sendAndLogReply({ messageId, waId, replyText, phoneNumberId });

    // guardamos sessionData inicial vacío (opcional)
    await updateSessionData(waId, {}); // asegura que exista Datos como JSON
    return;
  }
  // parseo seguro de Datos si es string JSON
  let sessionData = {};
  try {
    sessionData = typeof session.Datos === "string" ? JSON.parse(session.Datos || "{}") : (session.Datos || {});
  } catch (err) {
    logger.warn(`⚠️ Falló el parseo de session.Datos para ${waId}: ${err.message}`);
    sessionData = {};
  }

  let replyText = "";

  switch (session.EstadoConversacional) {
    // --- caso AWAITING_NAME (igual a lo que ya tenías, con guardado de clientes)
    // case "IDLE": {
    //   replyText = "¡Hola! Bienvenido. Decime 'menu' para ver las opciones o escribí 'ayuda'.";
    //   await updateSessionState(waId, "NEW"); // o el estado que use tu flujo para iniciar (p. ej. AWAITING_NAME)
    //   break;
    // }
        
    case "AWAITING_NAME": {
      const name = (text || "").trim();
      if (!name) {
        replyText = "No entendí tu nombre. ¿Podés escribirlo de nuevo, por favor?";
        await sendAndLogReply({ messageId, waId, replyText, phoneNumberId });
        break;
      }
      // guardamos el nombre en la tabla de clientes o en session.Datos según tu diseño
      // preferible: saveName guarda en la tabla de clientes y updateSessionData guarda en sesión
      //await saveName(waId, name); // mantiene registro persistente de usuario
      sessionData.nombre = name;
      await updateSessionData(waId, sessionData);
      
      const frequentAddresses = await getFrequentAddresses(waId);
      if (frequentAddresses && frequentAddresses.length > 0) {
        // evitar reenvío si ya se envió antes
        if (sessionData.direccionesEnviadas) {
          replyText = "Ya te envié tus direcciones. Respondé con el número o escribí una nueva dirección.";
        } else {
          sessionData.clientes = frequentAddresses;
          sessionData.direccionesEnviadas = true; // marcamos como enviadas
          await updateSessionData(waId, sessionData);
          await updateSessionState(waId, "AWAITING_ADDRESS_SELECTION");

          const options = frequentAddresses.map((addr, i) =>
            `${i + 1}. ${addr.calle} ${addr.numero} ${addr.comentario || ""}`
          ).join("\n");

          replyText = `Gracias, ${name}. Estas son tus direcciones más usadas:\n\n${options}\n\n${frequentAddresses.length + 1}. Otra dirección\n\nRespondé con el número o escribí una nueva dirección.`;
        }
      }
      await sendAndLogReply({ messageId, waId, replyText, phoneNumberId });
      // await saveOutgoingReply({
      //   MessageId: /* generar id si aplicable */ messageId + ":reply",
      //   WaId: waId,
      //   Body: replyText,
      //   SentAt: new Date()
      // });
      break;
    }

    // --- caso AWAITING_ADDRESS_SELECTION (SELECTION con las 3 vías)
    case "AWAITING_ADDRESS_SELECTION": {
      const choice = parseInt(text, 10);
      const clientes = sessionData.clientes || [];

      // validación defensiva: si no hay clientes en sesión, recalculamos y pedimos input
      if (!Array.isArray(clientes) || clientes.length === 0) {
        logger.warn(`⚠️ No hay direcciones en sesión para ${waId}. Recalculando...`);
        const fallback = await getFrequentAddresses(waId);
        await updateSessionData(waId, { ...sessionData, clientes: fallback });
        replyText = "No encontré tus direcciones anteriores. ¿Podés escribir la dirección o enviarme tu ubicación?";
        await updateSessionState(waId, "AWAITING_ADDRESS_INPUT");
        break;
      }

      // 1) Selección válida: procesar y terminar
      if (!isNaN(choice) && choice >= 1 && choice <= clientes.length) {
        const selected = clientes[choice - 1];
        await saveAddress(waId, selected);
        await updateSessionState(waId, "ORDER_ACTIVE");
        replyText = `Perfecto. Usaremos la dirección: ${selected.calle} ${selected.numero}. Te avisamos cuando salga el móvil.`;
        break;
      }

      // 2) Si el usuario eligió la opción "Otra dirección" (ej: número siguiente)
      const otraOption = clientes.length + 1;
      if (!isNaN(choice) && choice === otraOption) {
        await updateSessionState(waId, "AWAITING_ADDRESS_INPUT");
        replyText = "Perfecto, escribí la dirección completa o enviame tu ubicación.";
        break;
      }

      // 3) Si el usuario escribió una dirección (texto) -> pasar a INPUT
      if (isLikelyAddress(text) || msg.type === "location") {
        await updateSessionState(waId, "AWAITING_ADDRESS_INPUT");
        // guardamos intención / no es necesario guardar el texto ahora
        replyText = "Perfecto, podés escribir la dirección completa o enviarme tu ubicación.";
        break;
      }

      // 4) No es selección ni dirección: pedir reintento y quedarnos en SELECTION
      replyText = `No entendí tu respuesta. Elegí una opción del 1 al ${clientes.length + 1}, o escribí una nueva dirección.`;
      // no cambiamos el estado: seguimos en AWAITING_ADDRESS_SELECTION
      break;
    }

    // --- caso AWAITING_ADDRESS_INPUT (aceptar números como reintento y normalizar direcciones)
    case "AWAITING_ADDRESS_INPUT": {
      const choice = parseInt(text, 10);
      const clientes = sessionData.clientes || [];

      // A) Si es un número válido y hay clientes en sesión, interpretarlo como selección reintentada
      if (!isNaN(choice) && Array.isArray(clientes) && clientes.length > 0 && choice >= 1 && choice <= clientes.length) {
        const selected = clientes[choice - 1];
        await saveAddress(waId, selected);
        await updateSessionState(waId, "ORDER_ACTIVE");
        replyText = `Perfecto. Usaremos la dirección: ${selected.calle} ${selected.numero}. Te avisamos cuando salga el móvil.`;
        break;
      }

      // B) Si llegó una ubicación (payload), intentar normalizarla
      if (msg.type === "location" && typeof normalizeLocationToAddress === "function") {
        const parsed = await normalizeLocationToAddress(msg);
        if (parsed?.calle && parsed?.numero) {
          await saveAddress(waId, parsed);
          await updateSessionState(waId, "ORDER_ACTIVE");
          replyText = `Recibimos tu ubicación: ${parsed.calle} ${parsed.numero}. Te avisamos cuando salga el móvil.`;
        } else {
          replyText = "No pude obtener la dirección desde la ubicación. Podés escribirla manualmente.";
        }
        break;
      }

      // C) Intentar normalizar texto libre como dirección
      if (isLikelyAddress(text)) {
        const parsed = await normalizeAddress(text);
        if (parsed?.calle && parsed?.numero) {
          await saveAddress(waId, parsed);
          await updateSessionState(waId, "ORDER_ACTIVE");
          replyText = `Recibimos tu dirección: ${parsed.calle} ${parsed.numero}. Te avisamos cuando salga el móvil.`;
        } else {
          replyText = "No pude entender la dirección. ¿Podés repetirla más completa o enviarme tu ubicación?";
          // nos quedamos en AWAITING_ADDRESS_INPUT para permitir reintentos
        }
      } else {
        // si no parece dirección ni selección, pedir aclaración y quedarnos en INPUT
        replyText = "No entendí. Escribí la dirección completa o elegí una de las opciones anteriores.";
      }
      break;
    }

    
    default: {
      // caso por defecto: si el estado es IDLE o algo inesperado, invitá al usuario
      if (session.EstadoConversacional === "IDLE" || !session.EstadoConversacional) {
        await updateSessionState(waId, "AWAITING_NAME");
        replyText="¡Hola! Antes de continuar, ¿cómo te llamás?"
        await sendAndLogReply({ messageId, waId, replyText, phoneNumberId });
        break;
      }
      replyText = "No reconozco tu estado actual. Decime 'menu' para empezar de nuevo.";
      // en lugar de await sendReply(waId, replyText);
      await sendAndLogReply({ messageId, waId, replyText, phoneNumberId });

      break;
    }
  } // end switch

  // enviar reply (tu función actual de envío)
  await sendAndLogReply({ messageId, waId, replyText, phoneNumberId });

}




// async function handleInboundMessage(msg, value) {
//   const waId = msg.from;
//   const text = msg.text?.body?.trim() || "";
//   const timestamp = new Date();
//   const phoneNumberId = value.metadata.phone_number_id;

//   // 📝 Loguear mensaje recibido
//   await insertMessageLog({
//     WaId: waId,
//     TipoMensaje: msg.type,
//     Contenido: text,
//     Timestamp: timestamp,
//     Metadata: value.metadata
//   });

//   let session = await getSession(waId);
//   let replyText;
  
//   // Si no hay sesión, inicializarla
//   if (!session) {
//     await updateSessionState(waId, "IDLE");
//     logger.info(`🆕 Nueva sesión para ${waId} → Estado: IDLE`);
//     session = { EstadoConversacional: "IDLE" };
//   }
//   logger.info(`**************** ESTADO: ${session.EstadoConversacional}`);
//   switch (session.EstadoConversacional) {
//     case "IDLE":
//       if (isGreeting(text)) {
//         await updateSessionState(waId, "AWAITING_NAME");
//         logger.info(`🔄 Estado ${waId}: IDLE → AWAITING_NAME`);
//         replyText = "Hola 👋 ¿Cómo te llamás?";
//       } else if (isLikelyAddress(text) || msg.type === "location") {
//         await updateSessionState(waId, "AWAITING_NAME");
//         logger.info(`🔄 Estado ${waId}: IDLE → AWAITING_NAME`);
//         replyText = "Antes de pedir el viaje, ¿me decís tu nombre?";
//       } else {
//         replyText = "Hola 👋 ¿Querés pedir un viaje? Podés decir 'hola' o enviarme tu dirección.";
//       }
//       break;

//     case "AWAITING_NAME": {
//         const name = text.trim();
//         await saveName(waId, name);
//         await updateSessionState(waId, "AWAITING_ADDRESS_SELECTION");

//         const frequentAddresses = await getFrequentAddresses(waId);
//         if (frequentAddresses.length > 0) {
//           await updateSessionData(waId, { clientes: frequentAddresses }); // ← guardás los 3 en sesión
//           const options = frequentAddresses.map((addr, i) =>
//             `${i + 1}. ${addr.calle} ${addr.numero} ${addr.comentario || ""}`
//           ).join("\n");

//           replyText = `Gracias, ${name}. Estas son tus direcciones más usadas:\n\n${options}\n\n4. Otra dirección\n\nRespondé con el número o escribí una nueva dirección.`;
//         } else {
//           await updateSessionState(waId, "AWAITING_ADDRESS_INPUT");
//           replyText = `Gracias, ${name}. Decime la dirección: Calle Nº [comentario], o enviá tu ubicación.`;
//         }
//         break;
//       }

//       case "AWAITING_ADDRESS_SELECTION": {
//         const choice = parseInt(text.trim(), 10);
//         const clientes = session?.clientes || [];

//       // 🔒 Validación defensiva
//         if (!Array.isArray(clientes) || clientes.length === 0) {
//           logger.warn(`⚠️ No hay direcciones en sesión para ${waId}. Recalculando...`);
//           const fallback = await getFrequentAddresses(waId);
//           await updateSessionData(waId, { clientes: fallback });
//           replyText = "No encontré tus direcciones anteriores. ¿Podés escribir la dirección o enviarme tu ubicación?";
//           await updateSessionState(waId, "AWAITING_ADDRESS_INPUT");
//           break;
//         }  
//         // ✅ Procesar elección
//         if (!isNaN(choice) && choice >= 1 && choice <= clientes.length) {
//           const selected = clientes[choice - 1];
//           await saveAddress(waId, selected);
//           await updateSessionState(waId, "ORDER_ACTIVE");
//           replyText = `Perfecto. Usaremos la dirección: ${selected.calle} ${selected.numero}. Te avisamos cuando salga el móvil.`;
//         } else {
//           await updateSessionState(waId, "AWAITING_ADDRESS_INPUT");
//           replyText = "Escribí la dirección completa o enviá tu ubicación.";
//         }
//         break;
//       }
      

//       case "AWAITING_ADDRESS_INPUT": {
//         const parsed = await normalizeAddress(text);
//         if (parsed?.calle && parsed?.numero) {
//           await saveAddress(waId, parsed);
//           await updateSessionState(waId, "ORDER_ACTIVE");
//           replyText = `Recibimos tu dirección: ${parsed.calle} ${parsed.numero}. Te avisamos cuando salga el móvil.`;
//         } else {
//           replyText = "No pude entender la dirección. ¿Podés repetirla o enviarme tu ubicación?";
//         }
//         break;
//       }

//     case "ORDER_ACTIVE":
//       if (text.toLowerCase().includes("cancelar")) {
//         await updateSessionState(waId, "IDLE");
//         logger.info(`🔄 Estado ${waId}: ORDER_ACTIVE → IDLE`);
//         replyText = "Tu viaje ha sido cancelado. Gracias.";
//       } else {
//         replyText = "Tu pedido sigue activo. Si querés cancelar, escribí 'cancelar'.";
//       }
//       break;

//     default:
//       replyText = "No entendí tu mensaje. ¿Podés repetirlo?";
//   }

//   // Enviar respuesta
//   const apiResponse = await sendTextMessage(waId, replyText, phoneNumberId);

//   // Loguear respuesta
//   await insertReplyLog({
//     WaId: waId,
//     ReplyText: replyText,
//     RelatedMessageId: msg.id || null,
//     PhoneNumberId: phoneNumberId,
//     ApiResponse: apiResponse
//   });

//   logger.info(`📤 Respuesta enviada a ${waId}: "${replyText}"`);
// }


module.exports = { handleInboundMessage };