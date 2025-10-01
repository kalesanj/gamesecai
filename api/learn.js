// put near the top of /api/learn.js
export const config = { runtime: "nodejs" };
/* ... keep your parseJSON, norm, KB, helpers ... */

// >>> NEW: version-flexible Gemini caller (v1 then v1beta), no "-latest"
async function callGemini(apiKey, prompt, genCfg = {}) {
  const versions = ["v1", "v1beta"];
  const models = ["gemini-1.5-flash", "gemini-1.5-flash-001", "gemini-1.5-pro", "gemini-1.0-pro"];
  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }]}],
    generationConfig: { temperature: 0.3, maxOutputTokens: 220, ...genCfg },
  };
  let lastErr = null;

  for (const ver of versions) {
    for (const m of models) {
      const url = `https://generativelanguage.googleapis.com/${ver}/models/${m}:generateContent?key=${apiKey}`;
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const raw = await r.text();

      if (r.ok) {
        let j; try { j = JSON.parse(raw); } catch { j = {}; }
        const text = j?.candidates?.[0]?.content?.parts?.[0]?.text || null;
        if (text) return { text, model: m, version: ver };
      } else {
        lastErr = { status: r.status, details: raw.slice(0,200), model: m, version: ver };
      }
    }
  }
  return { error: "Gemini request failed", ...lastErr };
}
