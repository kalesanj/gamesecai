export const config = { runtime: "nodejs" };

// Try multiple (version, model) combos until one works
async function callGemini(apiKey, prompt, genCfg = {}) {
  const versions = ["v1", "v1beta"];
  const models = ["gemini-1.5-flash", "gemini-1.5-flash-001", "gemini-1.5-pro", "gemini-1.0-pro"];
  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }]}],
    generationConfig: { temperature: 0.2, maxOutputTokens: 80, ...genCfg },
  };
  let lastErr = null;

  for (const ver of versions) {
    for (const m of models) {
      const url = `https://generativelanguage.googleapis.com/${ver}/models/${m}:generateContent?key=${apiKey}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const raw = await r.text();

      if (r.ok) {
        let j; try { j = JSON.parse(raw); } catch { j = {}; }
        const text = j?.candidates?.[0]?.content?.parts?.[0]?.text || null;
        if (text) return { text, model: m, version: ver };
      } else {
        lastErr = { status: r.status, details: raw.slice(0, 200), model: m, version: ver };
      }
    }
  }
  return { error: "Gemini request failed", ...lastErr };
}

export default async function handler(req, res) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

    const out = await callGemini(apiKey, "Explain DMARC in one safe sentence.");
    if (out.text) return res.status(200).json(out);
    return res.status(500).json(out);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
