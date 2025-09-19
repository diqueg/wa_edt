const { createLogger, format, transports } = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const { combine, timestamp, printf, colorize } = format;

// Formato de línea
const logFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level.toUpperCase()}]: ${message}`;
});

// Transport rotativo para todos los niveles (info, warn, error)
const combinedTransport = new DailyRotateFile({
  dirname: "logs",
  filename: "combined-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "10m",
  maxFiles: "14d"
});

// Transport rotativo solo para errores
const errorTransport = new DailyRotateFile({
  dirname: "logs",
  filename: "error-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  level: "error",             // solo errores
  zippedArchive: true,
  maxSize: "5m",
  maxFiles: "30d"             // guardamos errores 1 mes
});

const logger = createLogger({
  level: "info",
  format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), logFormat),
  transports: [
    // Consola en colores
    new transports.Console({ format: combine(colorize(), logFormat) }),
    // Archivos
    combinedTransport,
    errorTransport
  ]
});

module.exports = logger;
