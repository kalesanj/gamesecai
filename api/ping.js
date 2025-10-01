// /api/ping.js — simple health check
export const config = { runtime: "nodejs" };
export default function handler(req, res) {
  res.status(200).json({ ok: true, hasKey: !!process.env.GEMINI_API_KEY });
}
