// src/services/normalizer.js
const fetch = require("node-fetch");
const logger = require("../utils/logger");

const GEOCODING_PROVIDER = process.env.GEOCODING_PROVIDER || "google";
const GEOCODING_API_KEY = process.env.GEOCODING_API_KEY || "";

async function normalizeAddress(text) {
  const t = (text || "").trim();
  if (!t) return null;

  // 1. intento local rápido por regex: "Calle Nombre 123", "Av. Roca 45"
  const streetWords = /\b(calle|av|avenida|avda|pje|pasaje|barrio|b°)\b/i;
  const numberMatch = t.match(/(\d{1,5})/);
  if (streetWords.test(t) && numberMatch) {
    const calle = t.replace(numberMatch[0], "").replace(/\s+/g, " ").trim();
    return { calle: calle, numero: numberMatch[0], comentario: null };
  }

  // 2. fallback: llamar al proveedor de geocoding
  if (GEOCODING_PROVIDER === "google" && GEOCODING_API_KEY) {
    return await googleGeocode(t);
  }

  // 3. si no hay proveedor o no se pudo resolver
  return null;
}

async function normalizeLocationToAddress(msg) {
  // msg expected shape { type: "location", latitude, longitude }
  const lat = msg.latitude ?? msg.lat ?? null;
  const lon = msg.longitude ?? msg.long ?? msg.lon ?? null;
  if (!lat || !lon) return null;

  if (GEOCODING_PROVIDER === "google" && GEOCODING_API_KEY) {
    return await googleReverseGeocode(lat, lon);
  }

  return null;
}

// helpers para Google Geocoding (simplificados)
async function googleGeocode(address) {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GEOCODING_API_KEY}&region=ar`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.status !== "OK" || !json.results?.length) return null;
    const r = json.results[0];
    const parsed = parseGoogleAddressComponents(r.address_components);
    return {
      calle: parsed.route || parsed.street || null,
      numero: parsed.street_number || parsed.number || null,
      comentario: parsed.subpremise || r.formatted_address,
      lat: r.geometry.location.lat,
      lon: r.geometry.location.lng
    };
  } catch (err) {
    logger.warn(`googleGeocode error: ${err.message}`);
    return null;
  }
}

async function googleReverseGeocode(lat, lon) {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${GEOCODING_API_KEY}&result_type=street_address|premise`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.status !== "OK" || !json.results?.length) return null;
    const r = json.results[0];
    const parsed = parseGoogleAddressComponents(r.address_components);
    return {
      calle: parsed.route || parsed.street || null,
      numero: parsed.street_number || parsed.number || null,
      comentario: parsed.subpremise || r.formatted_address,
      lat: lat,
      lon: lon
    };
  } catch (err) {
    logger.warn(`googleReverseGeocode error: ${err.message}`);
    return null;
  }
}

function parseGoogleAddressComponents(components) {
  const out = {};
  for (const c of components) {
    if (c.types.includes("route")) out.route = c.long_name;
    if (c.types.includes("street_number")) out.street_number = c.long_name;
    if (c.types.includes("premise") || c.types.includes("subpremise")) out.subpremise = c.long_name;
    if (c.types.includes("locality")) out.city = c.long_name;
    if (c.types.includes("administrative_area_level_1")) out.state = c.long_name;
    if (c.types.includes("country")) out.country = c.long_name;
  }
  return out;
}


module.exports = {
  normalizeAddress,
  normalizeLocationToAddress
};
