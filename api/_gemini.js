export const config = { runtime: "nodejs" };

// Simple in-memory cache (10 minutes)
const CACHE_TTL_MS = 10 * 60 * 1000;
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
  // Prefer flash → pro, newest first
  const byPref = (name) => (
    name.includes("gemini") &&
    !name.includes("vision") && (
      name.includes("1.5-flash") ||
      name.includes("1.5-pro") ||
      name.includes("1.0-pro") ||
      name.includes("pro") ||
      name.includes("flash")
    )
  );
  const sorted = models.map(m => m.name || "").filter(byPref).sort((a, b) => b.localeCompare(a));
  return sorted[0] || null;
}

// Discover a usable (version, model) for this key
export async function discoverModel(apiKey) {
  const now = Date.now();
  if (cache.model && now - cache.ts < CACHE_TTL_MS) return { version: cache.version, model: cache.model };

  const versions = ["v1", "v1beta"];
  for (const version of versions) {
    try {
      const models = await listModels(apiKey, version);
      const pick = choose(models);
      if (pick) {
        cache = { model: pick.replace(/^models\//, ""), version, ts: now };
        return { version: cache.version, model: cache.model };
      }
    } catch { /* try next */ }
  }
  throw new Error("No compatible Gemini model available for this key.");
}

export async function generate(apiKey, { version, model }, prompt, genCfg = {}) {
  const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }]}],
    generationConfig: { temperature: 0.3, maxOutputTokens: 220, ...genCfg }
  };
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const raw = await r.text();
  if (!r.ok) throw Object.assign(new Error("generateContent failed"), { status: r.status, details: raw.slice(0, 300) });
  let j; try { j = JSON.parse(raw); } catch { j = {}; }
  const text = j?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  if (!text) throw new Error("Empty response from Gemini.");
  return text;
}
