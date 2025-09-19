const fetch = global.fetch || require("node-fetch");

async function analyzeMessage(text) {
  //try {
    // Devuelve siempre un resultado fijo para pruebas
  return {
    ok: true,
    calle: "Prueba",
    numero: "123"
  };
      
    
//       const res = await fetch("http://localhost:4000/analizaDireccion", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ mensaje: text })
//     });

//     const data = await res.json();

//     if (data && data.ok) {
//       return { ok: true, calle: data.calle, numero: data.numero };
//     }

//     return { ok: false };
//   } catch (err) {
//     console.error("❌ Error llamando al WS:", err);
//     return { ok: false };
//   }
}

function isGreeting(text) {
  const t = text.trim().toLowerCase();
  return ["hola", "buenas", "hey", "👋"].some(g => t.includes(g));
}

function isLikelyAddress(text) {
  return /\d{2,}/.test(text) && /[a-zA-Z]/.test(text);
}

module.exports = {
  isGreeting,
  isLikelyAddress,
  analyzeMessage
};
