const sql = require("mssql");
const poolPromise = require("./index");
const logger = require("../utils/logger");

const { poolPromise, sql } = require('./index'); // ajustá ruta
const logger = require('../utils/logger');

async function insertReplyLog({ ReplyId, MessageId, WaId, ReplyText, PhoneNumberId, Status }) {
  const pool = await poolPromise;
  try {
    await pool.request()
      .input('ReplyId', sql.VarChar(200), ReplyId || null)
      .input('MessageId', sql.VarChar(200), MessageId || null)
      .input('WaId', sql.VarChar(50), WaId)
      .input('ReplyText', sql.NVarChar(sql.MAX), ReplyText || null)
      .input('PhoneNumberId', sql.VarChar(50), PhoneNumberId || null)
      .input('Status', sql.VarChar(20), Status || 'PENDING')
      .query(`
        INSERT INTO dbo.WA_ReplyLog (ReplyId, MessageId, WaId, ReplyText, PhoneNumberId, Status, Timestamp)
        VALUES (@ReplyId, @MessageId, @WaId, @ReplyText, @PhoneNumberId, @Status, SYSUTCDATETIME());
      `);
    return true;
  } catch (err) {
    // unique violation => already exists
    if (err && (err.number === 2627 || err.number === 2601)) {
      logger.info(`insertReplyLog: already exists ReplyId=${ReplyId}`);
      return false;
    }
    logger.error(`insertReplyLog error ReplyId=${ReplyId} -> ${err.message}`);
    throw err;
  }
}

async function updateReplyLogStatus({ ReplyId, Status, TransportResult, ErrorMessage }) {
  const pool = await poolPromise;
  await pool.request()
    .input('ReplyId', sql.VarChar(200), ReplyId)
    .input('Status', sql.VarChar(20), Status)
    .input('TransportResult', sql.NVarChar(sql.MAX), TransportResult ? JSON.stringify(TransportResult) : null)
    .input('ErrorMessage', sql.NVarChar(sql.MAX), ErrorMessage || null)
    .query(`
      UPDATE dbo.WA_ReplyLog
      SET Status = @Status,
          TransportResult = COALESCE(@TransportResult, TransportResult),
          ErrorMessage = COALESCE(@ErrorMessage, ErrorMessage),
          Timestamp = CASE WHEN @Status = 'SENT' THEN SYSUTCDATETIME() ELSE Timestamp END
      WHERE ReplyId = @ReplyId;
    `);
  return true;
}

module.exports = { insertReplyLog, updateReplyLogStatus };


