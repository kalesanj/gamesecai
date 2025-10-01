export const config = { runtime: "nodejs" };

function parseJSON(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch { resolve({}); } });
  });
}

const DICT = {
  phishing: "Phishing is when attackers pose as trusted senders (email/SMS/web) to trick you into clicking links or giving credentials. Verify the sender and report suspicious messages.",
  macros: "Office macros are small programs in documents; attackers abuse them to run malicious code. Avoid enabling macros unless verified and necessary.",
  mfa: "MFA (multi-factor authentication) adds a second proof (code, key, app) to your password, making account takeovers much harder.",
  ransomware: "Ransomware encrypts files and demands payment. Prevent with backups, updates, and caution with attachments/links.",
  "social engineering": "Social engineering manipulates people into revealing info or granting access. Slow down, verify via official channels, and share minimal data."
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");
  try {
    const { query = "", context = "" } = await parseJSON(req);
    const qLower = String(query).trim().toLowerCase();

    for (const key of Object.keys(DICT)) {
      if (qLower.includes(key)) {
        return res.status(200).json({ text: DICT[key], source: "builtin" });
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({
        text: "General rule: pause on unexpected requests, verify through official channels, and avoid sharing credentials in response to prompts.",
        source: "fallback-no-key"
      });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    const system = "You are a concise cybersecurity tutor. Use 2–5 sentences. Provide general safety advice only; avoid operational hacking details.";
    const prompt = `${system}

Learner's question: ${query}
(For context only) Current quiz scenario: ${context || "N/A"}

Explain clearly and safely, then end with one short practical tip (e.g., 'Verify via official channels.').`;

    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }]}],
      generationConfig: { temperature: 0.35, maxOutputTokens: 200 }
    };

    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const raw = await r.text();
    if (!r.ok) {
      return res.status(200).json({
        text: "Here’s a general safety rule: slow down, verify sender/site via official channels, and enable MFA.",
        source: `fallback-gemini-${r.status}`
      });
    }

    let j; try { j = JSON.parse(raw); } catch { j = {}; }
    const textOut = j?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    return res.status(200).json({
      text: textOut || "Tip: verify via official channels and avoid clicking untrusted links.",
      source: "gemini"
    });
  } catch (e) {
    return res.status(200).json({
      text: "Temporary issue. Safety tip: verify requests independently and avoid unexpected links.",
      source: "fallback-error"
    });
  }
}
