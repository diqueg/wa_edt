const sql = require("mssql");
const poolPromise = require("./index");
const logger = require("../utils/logger");

async function insertReplyLog({ WaId, ReplyText, RelatedMessageId, PhoneNumberId, ApiResponse }) {
  try {
    logger.info(`📤 insertReplyLog → WaId: ${WaId}, Reply: "${ReplyText}", RelatedMsgId: ${RelatedMessageId || "null"}`);
    const pool = await poolPromise;
    logger.info(`🧾 insertReplyLog → RelatedMessageId: ${RelatedMessageId}`);
    const parsedId = parseInt(RelatedMessageId, 10);
    await pool.request()
    .input("WaId", sql.VarChar(20), WaId)
    .input("ReplyText", sql.NVarChar(sql.MAX), ReplyText)
    .input("RelatedMessageId", sql.Int, isNaN(parsedId) ? null : parsedId)
    .input("PhoneNumberId", sql.VarChar(50), PhoneNumberId)
    .input("ApiResponse", sql.NVarChar(sql.MAX), JSON.stringify(ApiResponse || {}))
    .query(`
      INSERT INTO WA_ReplyLog (WaId, ReplyText, RelatedMessageId, Timestamp, PhoneNumberId, Status, ApiResponse)
      VALUES (@WaId, @ReplyText, @RelatedMessageId, GETDATE(), @PhoneNumberId, 'sent', @ApiResponse)
    `);
logger.info(`✅ Reply registrado para ${WaId}`);
  } catch (err) {
    logger.error(`❌ insertReplyLog error → ${err.message}`);
    throw err;
  }
}

module.exports = { insertReplyLog };
