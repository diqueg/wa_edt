const sql = require("mssql");
const poolPromise = require("./index");
const logger = require("../utils/logger");

async function getSession(waId) {
  const pool = await poolPromise; // ← esta línea es clave

  const result = await pool.request()
    .input("WaId", sql.VarChar(20), waId)
    .query("SELECT * FROM WA_Session WHERE WaId = @WaId");

  return result.recordset[0];
}

async function updateSessionState(waId, estado) {
  if (!waId) throw new Error("updateSessionState requiere waId");
  const pool = await poolPromise;
logger.info(`******************** updateSessionState start waId=${waId} estado=${estado}`);  
  await pool.request()
    .input("WaId", sql.VarChar(20), waId)
    .input("Estado", sql.VarChar(50), estado)
    .query(`
      MERGE WA_Session AS target
      USING (SELECT @WaId AS WaId) AS source
      ON target.WaId = source.WaId
      WHEN MATCHED THEN
        UPDATE SET EstadoConversacional = @Estado, UltimaActualizacion = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (WaId, EstadoConversacional, UltimaActualizacion)
        VALUES (@WaId, @Estado, GETDATE());
    `);
  logger.info(`++++++++++++++++++updateSessionState done waId=${waId}`);
}

async function saveName(waId, nombre) {
  const pool = await poolPromise;

  await pool.request()
    .input("WaId", sql.VarChar(20), waId)
    .input("Nombre", sql.NVarChar(100), nombre)
    .query(`
      UPDATE WA_Session
      SET Nombre = @Nombre, UltimaActualizacion = GETDATE()
      WHERE WaId = @WaId
    `);
}

async function updateSessionData(WaId, data) {
  const pool = await poolPromise;

  // Convertís el objeto `data` a JSON para guardarlo como string
  const jsonData = JSON.stringify(data);

  await pool.request()
    .input("WaId", sql.VarChar(20), WaId)
    .input("Data", sql.NVarChar(sql.MAX), jsonData)
    .query(`
      UPDATE WA_Session
      SET Data = @Data
      WHERE WaId = @WaId
    `);
}

async function markSessionMessage(waId, messageId) {
  if (!waId || !messageId) throw new Error("markSessionMessage requiere waId y messageId");
  const pool = await poolPromise;
  const req = pool.request();
  req.input("WaId", sql.VarChar(50), String(waId));
  req.input("MessageId", sql.VarChar(200), String(messageId));

  const res = await req.query(`
    UPDATE WA_Session
    SET LastMessageId = @MessageId,
        LastMessageAt = SYSUTCDATETIME()
    OUTPUT inserted.LastMessageId, inserted.LastMessageAt
    WHERE WaId = @WaId
      AND (LastMessageId IS NULL OR LastMessageId <> @MessageId);
  `);

  const updated = res && res.recordset && res.recordset.length > 0;
  if (updated) {
    logger.info(`markSessionMessage: marked message ${messageId} for ${waId}`);
    return true; // procesar
  } else {
    logger.info(`markSessionMessage: duplicate or no session row for ${waId} message ${messageId}`);
    return false; // skip
  }
}

async function ensureSessionRow(waId) {
  const pool = await poolPromise;
  const req = pool.request();
  req.input("WaId", sql.VarChar(50), String(waId));
  // Intentamos crear la fila si no existe (MERGE simple)
  await req.query(`
    MERGE INTO WA_Session AS target
    USING (SELECT @WaId AS WaId) AS src
      ON target.WaId = src.WaId
    WHEN NOT MATCHED THEN
      INSERT (WaId, EstadoConversacional, Data, LastMessageId, LastMessageAt)
      VALUES (@WaId, 'IDLE', '{}', NULL, NULL);
  `);
}

async function markMessageProcessing(messageId, waId) {
  if (!messageId) throw new Error("markMessageProcessing requiere messageId");
  if (!waId) throw new Error("markMessageProcessing requiere waId");

  const pool = await poolPromise;
  const req = pool.request();
  req.input("WaId", sql.VarChar(50), String(waId));
  req.input("MessageId", sql.VarChar(200), String(messageId));

  // Aseguramos que exista la fila de sesión para evitar no-match.
  try {
    await ensureSessionRow(waId);
  } catch (err) {
    logger.error(`ensureSessionRow error for ${waId}: ${err.message}`);
    throw err;
  }

  // UPDATE atómico: sólo actualiza si LastMessageId es null o distinto al messageId
  try {
    const res = await req.query(`
      UPDATE WA_Session
      SET LastMessageId = @MessageId,
          LastMessageAt = SYSUTCDATETIME()
      OUTPUT inserted.LastMessageId, inserted.LastMessageAt
      WHERE WaId = @WaId
        AND (LastMessageId IS NULL OR LastMessageId <> @MessageId);
    `);

    const updated = res && res.recordset && res.recordset.length > 0;
    if (updated) {
      logger.info(`markMessageProcessing: marked message ${messageId} for ${waId}`);
      return true; // procesar
    } else {
      logger.info(`markMessageProcessing: duplicate for ${waId} message ${messageId}`);
      return false; // skip duplicate
    }
  } catch (err) {
    logger.error(`markMessageProcessing error for ${messageId}: ${err.message}`);
    throw err;
  }
}


exports.getSession = getSession;
exports.updateSessionState = updateSessionState;
exports.saveName = saveName;
exports.updateSessionData = updateSessionData;
exports.markSessionMessage = markSessionMessage;
exports.markMessageProcessing = markMessageProcessing;
exports.ensureSessionRow = ensureSessionRow;