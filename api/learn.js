// /api/learn.js
export const config = { runtime: "nodejs" };

function parseJSON(req) {
  return new Promise((resolve) => {
    let data = ""; req.on("data", c => data+=c);
    req.on("end", () => { try { resolve(JSON.parse(data||"{}")); } catch { resolve({}); } });
  });
}
const norm = (s="") => String(s).toLowerCase().replace(/\s+/g," ").trim();

const KB = [
  { keys:["it security team","security team","soc team","information security team","secops"], answer:() =>
`The IT security team protects the organization’s systems and data. Typical responsibilities:
• Monitor for threats and investigate alerts
• Handle incident response (containment/recovery)
• Manage access controls, MFA, and security tooling
• Patch/vulnerability management and hardening
• Security awareness training and policy enforcement
• Partner with IT/Dev to reduce risk and meet compliance` },
  { keys:["phishing"], answer:() =>
`Phishing is when attackers pose as trusted senders (email/SMS/web) to trick you into clicking links or giving credentials. Clues: unexpected requests, urgency, odd sender/URL. Best action: verify and report to security.` },
  { keys:["mfa","multi factor","two factor","2fa"], answer:() =>
`MFA adds a second proof (code, key, or app) alongside your password, blocking most account-takeovers even if a password leaks.` },
  { keys:["macros","macro","xlsm"], answer:() =>
`Office macros can run code in documents. Attackers abuse them to deliver malware. Don’t enable macros unless the sender and business need are verified.` },
  { keys:["ransomware"], answer:() =>
`Ransomware encrypts files and demands payment. Prevention: backups, patching, least privilege, careful handling of links/attachments, endpoint protection.` },
  { keys:["social engineering"], answer:() =>
`Social engineering manipulates people into granting access or info. Slow down, verify via official channels, and share only what’s necessary.` },
  { keys:["password","passphrase"], answer:() =>
`Use a password manager for unique, strong passphrases. Never reuse passwords and enable MFA wherever possible.` },
  { keys:["vpn"], answer:() =>
`A VPN encrypts traffic between your device and the company network. Use the company-approved VPN and keep it updated.` },
  { keys:["encryption"], answer:() =>
`Encryption protects data in transit (TLS/HTTPS) and at rest; only holders of the key can read it. It reduces impact if data is intercepted or stolen.` },
  { keys:["patch","update","vulnerability","cve"], answer:() =>
`Patching fixes known vulnerabilities. Apply updates promptly—delays raise the risk of exploitation.` },
  { keys:["what does this question tell","what does this scenario tell","what is this question about"], answer:(_,ctx)=>scenarioExplainer(ctx) },
  { keys:["why is this risky","why risky"], answer:(_,ctx)=>riskWhy(ctx) }
];

function scenarioExplainer(ctx="") {
  const c = norm(ctx);
  if (!c) return "This checks your ability to spot risk cues (unexpected requests, urgency, untrusted links/files) and choose the safest action.";
  if (c.includes("verify your account") || c.includes("password reset") || c.includes("unknown sender"))
    return "It’s about a likely phishing email pretending to be a password/verification notice. Safe action: don’t click—report to IT/security.";
  if (c.includes("usb")) return "It tests awareness of infected removable media. Safe action: give the USB to IT/security—never plug in unknown media.";
  if (c.includes("xlsm") || c.includes("macro")) return "It tests caution with macro-enabled docs that can run code. Verify via an independent channel before opening.";
  return "It tests safe decision-making: pause, verify via official channels, and avoid interacting with untrusted links, files, or urgent requests.";
}
function riskWhy(ctx="") {
  const c = norm(ctx);
  if (c.includes("macro") || c.includes(".xlsm")) return "Macro docs can execute code; attackers use them to install malware. Verify out-of-band before opening.";
  if (c.includes("password") && c.includes("email") && c.includes("link")) return "Attackers imitate password emails to steal credentials. Links may go to fake logins—report and use the official site.";
  return "It involves untrusted links/attachments or urgency—classic social-engineering signals. Verification reduces risk.";
}

function fromKB(query, context) {
  const q = norm(query);
  for (const item of KB) for (const k of item.keys) if (q.includes(k)) return item.answer(q, context);
  return null;
}

async function fromGemini(apiKey, query, context) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
  const system = [
    "You are a concise cybersecurity tutor.",
    "Answer the user's question directly and specifically.",
    "Avoid generic advice unless it directly answers the question.",
    "Use 2–5 sentences.",
    "No operational hacking instructions."
  ].join(" ");
  const prompt = `${system}

Question: ${query}
Context (optional): ${context || "N/A"}

Respond directly to the question. If asked 'what does the IT security team do', list key duties. If asked 'what does this question tell', explain what the scenario tests and the safe action.`;

  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }]}],
    generationConfig: { temperature: 0.3, maxOutputTokens: 220 }
  };

  const r = await fetch(url, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
  const raw = await r.text();
  if (!r.ok) return { error:"Gemini request failed", status:r.status, details: raw.slice(0,200) };
  let j; try { j = JSON.parse(raw); } catch { j = {}; }
  const text = j?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  return { text };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");
  try {
    const { query = "", context = "" } = await parseJSON(req);
    const kb = fromKB(query, context);
    if (kb) return res.status(200).json({ text: kb, source: "builtin" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const g = await fromGemini(apiKey, query, context);
      if (g?.text) return res.status(200).json({ text: g.text, source: "gemini" });
      if (g?.error) return res.status(200).json({ error:g.error, status:g.status, details:g.details, source:"gemini-error" });
    }

    return res.status(200).json({
      text: "General guidance: identify risk cues, verify via official channels, avoid untrusted links/files, and enable MFA.",
      source: "fallback"
    });
  } catch {
    return res.status(200).json({
      text: "Temporary issue. Tip: pause, verify independently, and follow policy (report to IT/security).",
      source: "error-fallback"
    });
  }
}
