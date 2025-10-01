export const config = { runtime: "nodejs" };
import { discoverModel, generate } from "./_gemini.js";
function parseJSON(req){return new Promise(r=>{let d="";req.on("data",c=>d+=c);req.on("end",()=>{try{r(JSON.parse(d||"{}"))}catch{r({})}})})}

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
