export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

    const sanitize = (t="") => String(t)
      .replace(/https?:\/\/\S+/g, "[link]")
      .replace(/\S+@\S+/g, "[email]")
      .slice(0,600);

    const { term = "" } = req.body || {};
    const prompt =
      "You are a concise cybersecurity tutor. Explain terms in 2–4 safe sentences. No risky details.\n\n"
      + `Explain the term: ${sanitize(term)}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const body = {
      contents: [{ role: "user", parts: [{ text: prompt }]}],
      generationConfig: { temperature: 0.3, maxOutputTokens: 220 }
    };

    const r = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!r.ok) return res.status(r.status).send(await r.text());

    const j = await r.json();
    const textOut = j?.candidates?.[0]?.content?.parts?.[0]?.text || "No response.";
    res.status(200).json({ text: textOut });
  } catch {
    res.status(500).json({ error: "AI error" });
  }
}
