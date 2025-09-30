// Node serverless API on Vercel (parses JSON body manually)
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

    // Parse JSON body safely
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const bodyStr = Buffer.concat(chunks).toString() || "{}";
    let body;
    try { body = JSON.parse(bodyStr); } catch { body = {}; }

    const sanitize = (t="") => String(t)
      .replace(/https?:\/\/\S+/g, "[link]")
      .replace(/\S+@\S+/g, "[email]")
      .slice(0,600);

    const term = sanitize(body.term || "");
    const prompt =
      "You are a concise cybersecurity tutor. Explain terms in 2–4 safe sentences. No risky details.\n\n"
      + `Explain the term: ${term}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }]}],
      generationConfig: { temperature: 0.3, maxOutputTokens: 220 }
    };

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error("Gemini ask-definition error:", r.status, txt);
      return res.status(500).json({ error: "Gemini request failed" });
    }

    const j = await r.json();
    const textOut = j?.candidates?.[0]?.content?.parts?.[0]?.text || "No response.";
    res.status(200).json({ text: textOut });
  } catch (e) {
    console.error("ask-definition exception:", e);
    res.status(500).json({ error: "AI error" });
  }
}
