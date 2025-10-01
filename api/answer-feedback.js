// /api/answer-feedback.js
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
  const tip = ` Tip: If your confidence was ${confidence}/5, keep practicing with varied examples and report anything suspicious to IT/security.`;
  return `${intro}${explain}${tip}`;
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
    if (!apiKey) return res.status(200).json({ text: localFeedback({ correct, question, chosen, ref, confidence }), source:"local" });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    const system = "Supportive cybersecurity tutor. Keep to 3–5 sentences. No operational hacking details.";
    const prompt = `${system}

Question: ${question}
User answer: ${chosen}
Correct: ${correct ? "Yes" : "No"}
Confidence (1–5): ${confidence}
Reference (safe): ${ref}

Give brief feedback and one safe tip.`;

    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }]}],
      generationConfig: { temperature: 0.35, maxOutputTokens: 180 }
    };

    const r = await fetch(url, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
    const raw = await r.text();

    if (!r.ok) {
      return res.status(200).json({ text: localFeedback({ correct, question, chosen, ref, confidence }), source:`local-fallback-${r.status}` });
    }

    let j; try { j = JSON.parse(raw); } catch { j = {}; }
    const textOut = j?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    return res.status(200).json({ text: textOut || localFeedback({ correct, question, chosen, ref, confidence }), source:"gemini" });
  } catch {
    return res.status(200).json({ text: localFeedback({ correct:false, question:"", chosen:"", ref:"", confidence:3 }), source:"local-error" });
  }
}
