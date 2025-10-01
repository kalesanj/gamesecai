export const config = { runtime: "nodejs" };

function parseJSON(req) {
  return new Promise((resolve) => {
    let data = ""; req.on("data", c => data+=c);
    req.on("end", () => { try { resolve(JSON.parse(data||"{}")); } catch { resolve({}); } });
  });
}
function localFeedback({ correct, question, chosen, ref, confidence }) {
  const intro = correct
    ? "✅ Correct. Nice work—your choice aligns with standard best practice."
    : "❌ Not quite. That choice isn’t safest for this situation.";
  const explain = ref
    ? ` Why: ${ref}`
    : " Aim to pause, verify through official channels, and avoid interacting with suspicious links or attachments.";
  const tip = ` Tip: If your confidence was ${confidence}/5, keep practicing and report anything suspicious to IT/security.`;
  return `${intro}${explain}${tip}`;
}

// Concrete-model Gemini caller shared here too
async function callGemini(apiKey, prompt, genCfg={}) {
  const models = ["gemini-1.5-flash", "gemini-1.5-flash-001", "gemini-pro"];
  const base = "https://generativelanguage.googleapis.com/v1beta/models";
  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }]}],
    generationConfig: { temperature: 0.35, maxOutputTokens: 180, ...genCfg }
  };

  let lastErr = null;
  for (const m of models) {
    const url = `${base}/${m}:generateContent?key=${apiKey}`;
    const r = await fetch(url, {
      method: "POST", headers: { "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    const raw = await r.text();
    if (r.ok) {
      let j; try { j = JSON.parse(raw); } catch { j = {}; }
      const text = j?.candidates?.[0]?.content?.parts?.[0]?.text || null;
      if (text) return { text, model: m };
    } else {
      lastErr = { status: r.status, details: raw.slice(0,200), model: m };
    }
  }
  return { error: "Gemini request failed", ...lastErr };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");
  try {
    const body = await parseJSON(req);
    const correct = !!body.correct;
    const confidence = Number(body.confidence ?? 3);
    const question = String(body.question || "");
    const chosen = String(body.selectedOptionText || "");
    const ref = String(body.explanation || "");

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const system = "Supportive cybersecurity tutor. Keep to 3–5 sentences. No operational hacking details.";
      const prompt = `${system}

Question: ${question}
User answer: ${chosen}
Correct: ${correct ? "Yes" : "No"}
Confidence (1–5): ${confidence}
Reference (safe): ${ref}

Give brief feedback and one safe tip.`;

      const g = await callGemini(apiKey, prompt);
      if (g.text) return res.status(200).json({ text: g.text, source: `gemini:${g.model}` });
      // else fall through to local feedback
    }

    return res.status(200).json({ text: localFeedback({ correct, question, chosen, ref, confidence }), source:"local" });
  } catch {
    return res.status(200).json({ text: localFeedback({ correct:false, question:"", chosen:"", ref:"", confidence:3 }), source:"local-error" });
  }
}
