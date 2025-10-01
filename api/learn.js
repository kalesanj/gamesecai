export const config = { runtime: "nodejs" };

function parseJSON(req) {
  return new Promise((resolve) => {
    let data = ""; req.on("data", c => data+=c);
    req.on("end", () => { try { resolve(JSON.parse(data||"{}")); } catch { resolve({}); } });
  });
}
const norm = (s="") => String(s).toLowerCase().replace(/\s+/g," ").trim();

/* ——— Local Knowledge Base (answers instantly even if Gemini fails) ——— */
const KB = [
  { keys:["nist","national institute of standards and technology","nist csf","csf"], answer:() =>
`NIST is the U.S. National Institute of Standards and Technology. In cybersecurity it’s known for:
• NIST CSF (Cybersecurity Framework): Identify, Protect, Detect, Respond, Recover
• SP 800 series guidance (e.g., 800-53 controls, 800-171)
Organizations use these to assess, improve, and communicate security posture.` },
  { keys:["it security team","security team","soc team","information security team","secops"], answer:() =>
`The IT security team protects the organization’s systems and data. Typical responsibilities:
• Monitor for threats and handle incident response
• Manage access controls, MFA, and security tooling (EDR, SIEM)
• Patch/vulnerability management, hardening, and policies
• Awareness training and partnering with IT/Dev to reduce risk and meet compliance` },
  { keys:["phishing"], answer:() =>
`Phishing is when attackers pose as trusted senders (email/SMS/web) to trick you into clicking links or giving credentials. Clues: unexpected requests, urgency, odd sender/URL. Best action: verify and report to security.` },
  { keys:["mfa","multi factor","two factor","2fa"], answer:() =>
`MFA adds a second proof (code, key, or app) alongside your password, blocking many account-takeovers even if a password leaks.` },
  { keys:["macros","macro","xlsm"], answer:() =>
`Office macros can run code in documents. Attackers abuse them to deliver malware. Don’t enable macros unless the sender and business need are verified.` },
  { keys:["ransomware"], answer:() =>
`Ransomware encrypts files and demands payment. Prevention: backups, patching, least privilege, careful links/attachments, endpoint protection.` },
  { keys:["social engineering"], answer:() =>
`Social engineering manipulates people into granting access or info. Slow down, verify via official channels, and share only what’s necessary.` },
  { keys:["dmarc","spf","dkim"], answer:() =>
`DMARC, SPF, and DKIM help receivers verify that an email truly came from the sender’s domain and how to handle failures—reducing spoofing/phishing.` },
  { keys:["siem"], answer:() =>
`A SIEM collects and correlates logs/alerts to help detect and investigate threats.` },
  { keys:["zero trust"], answer:() =>
`Zero Trust assumes no implicit trust. Always verify identity and device, limit access (least privilege), and continuously re-evaluate.` },
  { keys:["password","passphrase"], answer:() =>
`Use a password manager for unique, strong passphrases. Never reuse passwords and enable MFA.` },
  { keys:["vpn"], answer:() =>
`A VPN encrypts traffic between your device and company network. Use the approved client and keep it updated.` },
  { keys:["encryption"], answer:() =>
`Encryption protects data in transit (TLS/HTTPS) and at rest so only key holders can read it.` },
  { keys:["patch","update","vulnerability","cve"], answer:() =>
`Patching fixes known vulnerabilities. Apply updates promptly—delays raise exploitation risk.` },
  { keys:["what does this question tell","what does this scenario tell","what is this question about"], answer:(_,ctx)=>scenarioExplainer(ctx) },
  { keys:["why is this risky","why risky"], answer:(_,ctx)=>riskWhy(ctx) }
];

function scenarioExplainer(ctx="") {
  const c = norm(ctx);
  if (!c) return "This checks your ability to spot risk cues (unexpected requests, urgency, untrusted links/files) and choose the safest action.";
  if (c.includes("verify your account") || c.includes("password reset") || c.includes("unknown sender"))
    return "It’s about a likely phishing email pretending to be a verification/password notice. Safe action: don’t click—report to IT/security.";
  if (c.includes("usb")) return "It tests awareness of infected removable media. Safe action: hand the USB to IT/security—never plug unknown media.";
  if (c.includes("xlsm") || c.includes("macro")) return "It tests caution with macro-enabled documents that can run code. Verify via an independent channel before opening.";
  return "It tests safe decision-making: pause, verify via official channels, and avoid interacting with untrusted links, files, or urgent requests.";
}
function riskWhy(ctx="") {
  const c = norm(ctx);
  if (c.includes("macro") || c.includes(".xlsm")) return "Macro documents can execute code; attackers use them to install malware. Verify out-of-band before opening.";
  if (c.includes("password") && c.includes("email") && c.includes("link")) return "Attackers imitate password emails to steal credentials. Links may go to fake logins—report and use the official site.";
  return "It involves untrusted links/attachments or urgency—classic social-engineering signals. Verification reduces risk.";
}
function fromKB(query, context) {
  const q = norm(query);
  for (const item of KB) for (const k of item.keys) if (q.includes(k)) return item.answer(q, context);
  return null;
}

// Concrete-model Gemini caller (no "-latest")
async function callGemini(apiKey, prompt, genCfg={}) {
  const models = ["gemini-1.5-flash", "gemini-1.5-flash-001", "gemini-pro"];
  const base = "https://generativelanguage.googleapis.com/v1beta/models";
  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }]}],
    generationConfig: { temperature: 0.3, maxOutputTokens: 220, ...genCfg }
  };

  let lastErr = null;
  for (const m of models) {
    const url = `${base}/${m}:generateContent?key=${apiKey}`;
    const r = await fetch(url, {
      method: "POST", headers: { "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    const raw = await r.text();
    if (r.ok) {
      let j; try { j = JSON.parse(raw); } catch { j = {}; }
      const text = j?.candidates?.[0]?.content?.parts?.[0]?.text || null;
      if (text) return { text, model: m };
    } else {
      lastErr = { status: r.status, details: raw.slice(0,200), model: m };
    }
  }
  return { error: "Gemini request failed", ...lastErr };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");
  try {
    const { query = "", context = "" } = await parseJSON(req);

    // 1) KB
    const kb = fromKB(query, context);
    if (kb) return res.status(200).json({ text: kb, source: "builtin" });

    // 2) Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const system = [
        "You are a concise cybersecurity tutor.",
        "Answer directly and specifically (2–5 sentences).",
        "No operational hacking instructions."
      ].join(" ");
      const prompt = `${system}

Question: ${query}
Context (optional): ${context || "N/A"}

Respond directly to the question. If asked 'what does this question tell', explain what the scenario tests and the safe action.`;

      const g = await callGemini(apiKey, prompt);
      if (g.text) return res.status(200).json({ text: g.text, source: `gemini:${g.model}` });
      // If Gemini failed, fall through to fallback message rather than error
    }

    // 3) Helpful fallback
    return res.status(200).json({
      text: "General guidance: identify risk cues, verify via official channels, avoid untrusted links/files, and enable MFA.",
      source: "fallback"
    });
  } catch {
    return res.status(200).json({
      text: "Temporary issue. Tip: pause, verify independently, and report suspicious messages to IT/security.",
      source: "error-fallback"
    });
  }
}
