const express = require("express");
const app = express();
app.use(express.json());

// Diccionario básico de calles válidas
const callesValidas = ["urquiza", "san martin", "mitre", "belgrano"];

app.post("/analizaDireccion", (req, res) => {
  const { mensaje } = req.body;

  if (!mensaje) {
    return res.json({ ok: false, error: "mensaje vacío" });
  }

  // Normalizamos a minúsculas para simplificar
  const texto = mensaje.toLowerCase();

  // Buscar si contiene alguna calle válida
  const calleEncontrada = callesValidas.find((c) => texto.includes(c));

  // Extraer número (ej: primer grupo de dígitos)
  const matchNumero = texto.match(/\d{1,5}/);
  const numero = matchNumero ? matchNumero[0] : null;

  if (calleEncontrada && numero) {
    return res.json({
      ok: true,
      calle: calleEncontrada.replace(/\b\w/g, (l) => l.toUpperCase()), // Capitalizar
      numero
    });
  }

  // Si no se reconoce
  res.json({ ok: false });
});

const PORT = 4000; // puerto separado
app.listen(PORT, () => console.log(`🛠️ Mock WS corriendo en puerto ${PORT}`));
