const sql = require("mssql");
const poolPromise = require("./index");
const logger = require("../utils/logger");
const { getPhoneVariants } = require("../utils/phone");

async function getFrequentAddresses(rawPhone) {
  const { localNumber, withAreaCode } = getPhoneVariants(rawPhone);

  const pool = await poolPromise;
  const result = await pool.request()
    .input("localNumber", sql.VarChar(20), localNumber)
    .input("withAreaCode", sql.VarChar(20), withAreaCode)
    .query(`
            SELECT TOP 3 
                nro_cliente, 
                NOMBRE_calle AS calle, 
                CAST(numero AS VARCHAR(5)) AS numero, 
                ubicacion as comentario, 
                SUM(cant_pedidos) AS total_pedidos
            FROM CLIENTES
            WHERE Nro_Telefono = @localNumber OR Nro_Telefono = @withAreaCode
            GROUP BY nro_cliente, NOMBRE_calle, numero, ubicacion
            ORDER BY total_pedidos DESC
        
    `);

  return result.recordset;
}

// src/db/address.js
async function saveAddress(WaId, address) {
  const pool = await poolPromise;
  await pool.request()
    .input("WaId", sql.VarChar(20), WaId)
    .input("Calle", sql.VarChar(100), address.calle)
    .input("Numero", sql.VarChar(10), address.numero)
    .input("Comentario", sql.VarChar(100), address.comentario || null)
    .query(`
      INSERT INTO WA_AddressLog (WaId, Calle, Numero, Comentario, Timestamp)
      VALUES (@WaId, @Calle, @Numero, @Comentario, GETDATE())
    `);
}



module.exports = {
  getFrequentAddresses,
    saveAddress
};
