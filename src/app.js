// app.js
const express = require("express");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(require("../src/utils/webhook")); // monta /webhook

// GET de verificación (por si lo necesitás)
app.get("/webhook", (req, res) => {
  const verifyToken = process.env.VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === verifyToken) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

app.listen(process.env.PORT || 3000, () => console.log("OK"));
