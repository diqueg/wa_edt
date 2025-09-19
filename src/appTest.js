const express = require("express");
const { analyzeMessage } = require("./utils/analyzeMessage");

const app = express();
app.use(express.json());

app.post("/webhook", async (req, res) => {
  const entry = req.body?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;

  if (!value?.messages) {
    console.log("No hay mensajes en el evento recibido.");
    return res.sendStatus(200);
  }

  const msg = value.messages[0];
  const from = msg.from;
  const text = msg.text?.body || "";

  console.log(`Mensaje de ${from}: "${text}"`);

  // Simula el análisis del mensaje
  const resultado = await analyzeMessage(text);
  console.log("Resultado del análisis:", resultado);

  res.sendStatus(200);
});

app.listen(3000, () => {
  console.log("Servidor de prueba escuchando en puerto 3000");
});