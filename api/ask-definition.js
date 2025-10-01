// Always works: uses Gemini if available; otherwise built-in dictionary.
// Force Node runtime so our body parsing works on Vercel.
export const config = { runtime: "nodejs" };

// small, safe JSON parser for Vercel Node functions
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

// builtin dictionary (safe, short)
const DICT = {
  phishing: "Phishing is a scam where attackers pretend to be trusted sources (email, SMS, sites) to trick you into clicking links or giving passwords. Always verify the sender and report suspicious messages.",
  mfa: "MFA (multi-factor authentication) adds a second proof of identity, like a code or security key, in addition to your password, which makes account takeover much harder.",
  "multi factor authentication": "MFA (multi-factor authentication) adds a second proof of identity, like a code or security key, in addition to your password.",
  malware: "Malware is malicious software designed to damage devices or steal data. Avoid unknown attachments, keep software updated, and use trusted sources.",
  ransomware: "Ransomware encrypts files and demands payment to unlock them. Prevent with backups, updates, and careful handling of attachments/links.",
  "social engineering": "Social engineering is manipulating people into giving access or info. Slow down, verify requests through official channels, and share minimal data.",
  "homograph domain": "A homograph domain swaps look-alike characters (e.g., ‘paypaI.com’ using capital i). Check the address closely; a padlock does not guarantee legitimacy.",
  macro: "Office macros are small programs embedded in documents; they can be abused to run malware. Only enable macros from trusted, verified sources."
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");
  try {
    const { term = "" } = await parseJSON(req);
    const clean = String(term).trim().toLowerCase();

    // 1) Serve cached/builtin instantly
    if (DICT[clean]) return res.status(200).json({ text: DICT[clean], source: "builtin" });

    // 2) If no key, still return a safe generic text
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({
        text: `I don’t have an exact definition for “${term}”. General tip: slow down, verify the sender/site, and avoid clicking untrusted links.`,
        source: "fallback-no-key"
      });
    }

    // 3) Try Gemini (short prompt, robust errors)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    const prompt = `You are a concise cybersecurity tutor. Explain in 2–4 safe sentences.\n\nTerm: ${term}`;
    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }]}],
      generationConfig: { temperature: 0.3, maxOutputTokens: 160 }
    };

    const r = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const raw = await r.text();
    if (!r.ok) {
      // If Gemini fails, still return a useful generic
      return res.status(200).json({
        text: `Couldn’t fetch a live definition for “${term}”. Tip: verify the sender/site and report suspicious messages.`,
        source: `fallback-gemini-${r.status}`
      });
    }
    let j; try { j = JSON.parse(raw); } catch { j = {}; }
    const textOut = j?.candidates?.[0]?.content?.parts?.[0]?.text;
    return res.status(200).json({
      text: textOut || `No live definition returned for “${term}”. Use official docs and verify sources.`,
      source: "gemini"
    });
  } catch (e) {
    return res.status(200).json({
      text: "Temporary issue fetching a definition. Safety tip: don’t click links you didn’t expect—verify first.",
      source: "fallback-error"
    });
  }
}
