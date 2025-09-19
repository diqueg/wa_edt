const sql = require("mssql");
const poolPromise = require("./index");
const logger = require("../utils/logger");

async function insertMessageLog({ WaId, TipoMensaje, Contenido, Timestamp, Metadata }) {
  try {
    const pool = await poolPromise;

    logger.info(`📝 insertMessageLog → WaId: ${WaId}, Tipo: ${TipoMensaje}, Contenido: "${Contenido}"`);

    await pool.request()
      .input("WaId", sql.VarChar(20), WaId)
      .input("TipoMensaje", sql.VarChar(20), TipoMensaje)
      .input("Contenido", sql.NVarChar(sql.MAX), Contenido)
      .input("Timestamp", sql.DateTime, Timestamp)
      .input("Metadata", sql.NVarChar(sql.MAX), JSON.stringify(Metadata || {}))
      .query(`
        INSERT INTO WA_MessageLog (WaId, TipoMensaje, Contenido, Timestamp, Metadata, EstadoProcesamiento)
        VALUES (@WaId, @TipoMensaje, @Contenido, @Timestamp, @Metadata, 'pending')
      `);
  } catch (err) {
    logger.error(`❌ insertMessageLog error → ${err.message}`);
    throw err;
  }
}

module.exports = { insertMessageLog };
