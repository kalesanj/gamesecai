// Vercel Node serverless — robust body parsing + clearer Gemini errors
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

    // parse JSON body
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const bodyStr = Buffer.concat(chunks).toString() || "{}";
    let body; try { body = JSON.parse(bodyStr); } catch { body = {}; }

    const sanitize = (t="") => String(t)
      .replace(/https?:\/\/\S+/g, "[link]").replace(/\S+@\S+/g, "[email]").slice(0,600);

    const term = sanitize(body.term || "");
    const system = "You are a concise cybersecurity tutor. Explain terms in 2–4 safe sentences. No risky details.";
    const prompt = `${system}\n\nExplain the term: ${term}`;

    // Use the most available model alias
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }]}],
      generationConfig: { temperature: 0.3, maxOutputTokens: 220 }
    };

    const r = await fetch(url, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
    const raw = await r.text();
    if (!r.ok) {
      console.error("ask-definition Gemini error:", r.status, raw);
      return res.status(500).json({ error: "Gemini request failed", status: r.status, details: raw.slice(0,300) });
    }

    let j; try { j = JSON.parse(raw); } catch { j = {}; }
    const textOut = j?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    if (!textOut) return res.status(200).json({ text: "Definition unavailable (empty response)." });
    res.status(200).json({ text: textOut });
  } catch (e) {
    console.error("ask-definition exception:", e);
    res.status(500).json({ error: "Server error" });
  }
}
