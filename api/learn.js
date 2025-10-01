export const config = { runtime: "nodejs" };
import { discoverModel, generate } from "./_gemini.js";

function parseJSON(req){return new Promise(r=>{let d="";req.on("data",c=>d+=c);req.on("end",()=>{try{r(JSON.parse(d||"{}"))}catch{r({})}})})}
const norm = (s="") => String(s).toLowerCase().replace(/\s+/g," ").trim();

/* Local KB */
const KB = [
  { keys:["nist","national institute of standards and technology","nist csf","csf"], answer:()=>
`NIST is the U.S. National Institute of Standards and Technology. In cybersecurity it’s known for:
• NIST CSF (Cybersecurity Framework): Identify, Protect, Detect, Respond, Recover
• SP 800 series guidance (e.g., 800-53 controls, 800-171)
Organizations use these to assess, improve, and communicate security posture.` },
  { keys:["it security team","security team","soc team","information security team","secops"], answer:()=>
`The IT security team protects the organization’s systems and data. Typical responsibilities:
• Monitor for threats and handle incident response
• Manage access controls, MFA, and security tooling (EDR, SIEM)
• Patch/vulnerability management, hardening, and policies
• Awareness training and partnering with IT/Dev to reduce risk and meet compliance` },
  { keys:["phishing"], answer:()=>"Phishing is when attackers pose as trusted senders (email/SMS/web) to trick you into clicking links or giving credentials. Clues: unexpected requests, urgency, odd sender/URL. Best action: verify and report to security." },
  { keys:["mfa","multi factor","two factor","2fa"], answer:()=>"MFA adds a second proof (code, key, or app) alongside your password, blocking many account-takeovers even if a password leaks." },
  { keys:["macros","macro","xlsm"], answer:()=>"Office macros can run code in documents. Attackers abuse them to deliver malware. Don’t enable macros unless the sender and business need are verified." },
  { keys:["ransomware"], answer:()=>"Ransomware encrypts files and demands payment. Prevention: backups, patching, least privilege, careful links/attachments, endpoint protection." },
  { keys:["social engineering"], answer:()=>"Social engineering manipulates people into granting access or info. Slow down, verify via official channels, and share only what’s necessary." },
  { keys:["dmarc","spf","dkim"], answer:()=>"DMARC, SPF, and DKIM help receivers verify that an email truly came from the sender’s domain and how to handle failures—reducing spoofing/phishing." },
  { keys:["siem"], answer:()=>"A SIEM collects and correlates logs/alerts to help detect and investigate threats." },
  { keys:["zero trust"], answer:()=>"Zero Trust assumes no implicit trust. Always verify identity and device, limit access (least privilege), and continuously re-evaluate." },
  { keys:["password","passphrase"], answer:()=>"Use a password manager for unique, strong passphrases. Never reuse passwords and enable MFA." },
  { keys:["vpn"], answer:()=>"A VPN encrypts traffic between your device and company network. Use the approved client and keep it updated." },
  { keys:["encryption"], answer:()=>"Encryption protects data in transit (TLS/HTTPS) and at rest so only key holders can read it." },
  { keys:["patch","update","vulnerability","cve"], answer:()=>"Patching fixes known vulnerabilities. Apply updates promptly—delays raise exploitation risk." },
  { keys:["what does this question tell","what does this scenario tell","what is this question about"], answer:(_,ctx)=>scenarioExplainer(ctx) },
  { keys:["why is this risky","why risky"], answer:(_,ctx)=>riskWhy(ctx) }
];

function scenarioExplainer(ctx=""){const c=norm(ctx);
  if(!c)return"Checks your ability to spot risk cues (unexpected requests, urgency, untrusted links/files) and choose the safest action.";
  if(c.includes("verify your account")||c.includes("password reset")||c.includes("unknown sender"))return"Likely phishing posing as a verification/password notice. Safe action: do not click—report to IT/security.";
  if(c.includes("usb"))return"Tests awareness of infected removable media. Safe action: give the USB to IT/security—never plug unknown media.";
  if(c.includes("xlsm")||c.includes("macro"))return"Tests caution with macro-enabled docs that can run code. Verify out-of-band before opening.";
  return"General safe decision-making: pause, verify via official channels, avoid interacting with untrusted links/files or urgent requests.";
}
function riskWhy(ctx=""){const c=norm(ctx);
  if(c.includes("macro")||c.includes(".xlsm"))return"Macro docs can execute code; attackers use them to install malware. Verify out-of-band before opening.";
  if(c.includes("password")&&c.includes("email")&&c.includes("link"))return"Attackers imitate password emails to steal credentials. Links may go to fake logins—report and use the official site.";
  return"It involves untrusted links/attachments or urgency—classic social-engineering signals. Verification reduces risk.";
}
function fromKB(query,context){const q=norm(query);for(const it of KB){for(const k of it.keys){if(q.includes(k))return it.answer(q,context)}}return null;}

export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).end("Method Not Allowed");
  try{
    const { query="", context="" } = await parseJSON(req);

    // 1) KB first
    const kb = fromKB(query, context);
    if (kb) return res.status(200).json({ text: kb, source: "builtin" });

    // 2) Gemini (discover model/version dynamically)
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const pick = await discoverModel(apiKey);
      const system = "You are a concise cybersecurity tutor. Answer directly and specifically (2–5 sentences). No operational hacking instructions.";
      const prompt = `${system}

Question: ${query}
Context (optional): ${context || "N/A"}

Respond directly to the question. If asked 'what does this question tell', explain what the scenario tests and the safe action.`;

      try {
        const text = await generate(apiKey, pick, prompt, { temperature: 0.3, maxOutputTokens: 220 });
        return res.status(200).json({ text, source: `gemini:${pick.model}@${pick.version}` });
      } catch {/* fall through to fallback */}
    }

    // 3) Helpful fallback
    return res.status(200).json({
      text:"General guidance: identify risk cues, verify via official channels, avoid untrusted links/files, and enable MFA.",
      source:"fallback"
    });
  }catch(e){
    return res.status(200).json({ text:"Temporary issue. Tip: pause, verify independently, and report suspicious messages to IT/security.", source:"error-fallback" });
  }
}
