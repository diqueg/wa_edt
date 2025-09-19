const sql = require("mssql");

// Configuración de conexión
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: `${process.env.DB_SERVER}`, 
  port: parseInt(process.env.DB_PORT, 10) || 1433,
  database: process.env.DB_NAME,
  options: {
    encrypt: false,                    // true si usás Azure
    trustServerCertificate: true       // útil para entornos locales
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

// Crear pool de conexión
const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log("✅ Conexión a SQL Server establecida");
    return pool;
  })
  .catch(err => {
    console.error("❌ Error al conectar con SQL Server:", err);
  });

module.exports = poolPromise;
