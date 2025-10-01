export const config = { runtime: "nodejs" };

function parseJSON(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch { resolve({}); } });
  });
}

const DICT = {
  phishing: "Phishing is a scam where attackers pretend to be trusted sources to trick you into clicking links or giving passwords.",
  mfa: "MFA adds a second proof of identity (code, key, app) alongside your password.",
  malware: "Malware is malicious software designed to damage devices or steal data.",
  ransomware: "Ransomware encrypts files and demands payment to unlock them."
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");
  try {
    const { term = "" } = await parseJSON(req);
    const key = String(term).toLowerCase().trim();
    if (DICT[key]) return res.status(200).json({ text: DICT[key], source: "builtin" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(200).json({ text: `General tip: verify senders and avoid unexpected links.`, source: "fallback-no-key" });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    const prompt = `You are a concise cybersecurity tutor. Explain "${term}" in 2–4 safe sentences.`;
    const payload = { contents: [{ role: "user", parts: [{ text: prompt }]}], generationConfig: { temperature: 0.3, maxOutputTokens: 160 } };

    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const raw = await r.text();
    if (!r.ok) return res.status(200).json({ text: "Tip: slow down and verify via official channels.", source: `fallback-gemini-${r.status}` });

    let j; try { j = JSON.parse(raw); } catch { j = {}; }
    const textOut = j?.candidates?.[0]?.content?.parts?.[0]?.text || "No definition returned.";
    return res.status(200).json({ text: textOut, source: "gemini" });
  } catch {
    return res.status(200).json({ text: "Temporary issue fetching a definition.", source: "fallback-error" });
  }
}
