// Limpia el número: elimina +, espacios, guiones, paréntesis, etc.
function normalizePhoneNumber(rawPhone) {
  return rawPhone.replace(/\D/g, "");
}

// Devuelve dos variantes del número: con característica y sin
function getPhoneVariants(rawPhone) {
  const cleaned = normalizePhoneNumber(rawPhone);
  const localNumber = cleaned.slice(-7); // últimos 7 dígitos
  const withAreaCode = cleaned;          // número completo

  return { localNumber, withAreaCode };
}

// Extrae la característica si existe (ej. 341, 343, 3402)
function extractAreaCode(rawPhone) {
  const cleaned = normalizePhoneNumber(rawPhone);
  return cleaned.length > 7 ? cleaned.slice(0, cleaned.length - 7) : null;
}

module.exports = {
  normalizePhoneNumber,
  getPhoneVariants,
  extractAreaCode
};
