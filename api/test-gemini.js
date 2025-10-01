// /api/test-gemini.js — validates your Gemini key quickly
export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ role: "user", parts: [{ text: "Explain DMARC in one sentence, safely." }]}],
      generationConfig: { temperature: 0.2, maxOutputTokens: 60 }
    };

    const r = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const raw = await r.text();
    if (!r.ok) return res.status(500).json({ error: "Gemini request failed", status: r.status, details: raw.slice(0, 200) });

    let j; try { j = JSON.parse(raw); } catch { j = {}; }
    const text = j?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
