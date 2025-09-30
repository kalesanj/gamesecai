// Force Node.js runtime (not Edge)
export const config = { runtime: "nodejs" };

function parseJSON(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try { resolve(JSON.parse(data || "{}")); }
      catch { resolve({}); }
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

    const body = await parseJSON(req);

    const sanitize = (t="") =>
      String(t).replace(/https?:\/\/\S+/g,"[link]").replace(/\S+@\S+/g,"[email]").slice(0,600);

    const term = sanitize(body.term || "");
    const system = "You are a concise cybersecurity tutor. Explain terms in 2–4 safe sentences. No risky details.";
    const prompt = `${system}\n\nExplain the term: ${term}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }]}],
      generationConfig: { temperature: 0.3, maxOutputTokens: 220 }
    };

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const raw = await r.text();
    if (!r.ok) {
      console.error("ask-definition fail:", r.status, raw.slice(0,200));
      return res.status(500).json({ error: "Gemini request failed", status: r.status, details: raw.slice(0,200) });
    }

    let j; try { j = JSON.parse(raw); } catch { j = {}; }
    const textOut = j?.candidates?.[0]?.content?.parts?.[0]?.text;
    res.status(200).json({ text: textOut || "Definition unavailable." });
  } catch (e) {
    console.error("ask-definition exception:", e);
    res.status(500).json({ error: "Server error" });
  }
}
