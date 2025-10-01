export const config = { runtime: "nodejs" };

// --- helper (model discovery + cached) ---
const CACHE_TTL_MS = 60 * 60 * 1000;
let cache = { model: null, version: null, ts: 0 };

async function listModels(apiKey, version) {
  const url = `https://generativelanguage.googleapis.com/${version}/models?key=${apiKey}`;
  const r = await fetch(url);
  const raw = await r.text();
  if (!r.ok) throw Object.assign(new Error("ListModels failed"), { status: r.status, details: raw.slice(0, 200) });
  let j; try { j = JSON.parse(raw); } catch { j = {}; }
  return j.models || [];
}
function choose(models) {
  const allow = (name) =>
    name.includes("gemini") &&
    !name.includes("vision") &&
    (name.includes("1.5-flash") || name.includes("flash") || name.includes("1.5-pro") || name.includes("1.0-pro") || name.includes("pro"));
  const sorted = models.map(m => m.name || "").filter(allow).map(n => n.replace(/^models\//, "")).sort((a,b)=>b.localeCompare(a));
  return sorted[0] || null;
}
async function discoverModel(apiKey) {
  const now = Date.now();
  if (cache.model && now - cache.ts < CACHE_TTL_MS) return { version: cache.version, model: cache.model };
  for (const version of ["v1", "v1beta"]) {
    try {
      const pick = choose(await listModels(apiKey, version));
      if (pick) { cache = { model: pick, version, ts: now }; return { version, model: pick }; }
    } catch { /* try next */ }
  }
  throw new Error("No compatible Gemini model available for this key.");
}
async function generate(apiKey, { version, model }, prompt, genCfg = {}) {
  const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }]}],
    generationConfig: { temperature: 0.2, maxOutputTokens: 140, ...genCfg }
  };
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const raw = await r.text();
  if (!r.ok) throw Object.assign(new Error("generateContent failed"), { status: r.status, details: raw.slice(0, 300) });
  let j; try { j = JSON.parse(raw); } catch { j = {}; }
  const text = j?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  if (!text) throw new Error("Empty response from Gemini.");
  return text;
}

// --- request parsing ---
function parseJSON(req){
  return new Promise(res=>{
    let d=""; req.on("data",c=>d+=c);
    req.on("end",()=>{ try{res(JSON.parse(d||"{}"))}catch{res({})} });
  });
}

// --- handler (Gemini-only) ---
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: "GEMINI_API_KEY missing" });

    const { query = "", context = "" } = await parseJSON(req);
    const pick = await discoverModel(apiKey);

    const system = "You are a precise cybersecurity tutor. Answer directly in 2–4 short sentences. No operational hacking instructions.";
    const prompt = `${system}\n\nQuestion: ${String(query).trim()}\nContext: ${String(context||"").trim() || "N/A"}\n\nBe concise and specific.`;

    const text = await generate(apiKey, pick, prompt, { maxOutputTokens: 140, temperature: 0.2 });
    res.status(200).json({ text, source: `gemini:${pick.model}@${pick.version}` });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || "Gemini error", status: e.status, details: e.details });
  }
}
