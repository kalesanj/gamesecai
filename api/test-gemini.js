export const config = { runtime: "nodejs" };
import { discoverModel, generate } from "./_gemini.js";

export default async function handler(req, res) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

    const pick = await discoverModel(apiKey);
    const text = await generate(apiKey, pick, "Explain DMARC in one safe sentence.", { maxOutputTokens: 60, temperature: 0.2 });
    return res.status(200).json({ text, model: pick.model, version: pick.version });
  } catch (e) {
    return res.status(500).json({ error: e.message, status: e.status, details: e.details });
  }
}
