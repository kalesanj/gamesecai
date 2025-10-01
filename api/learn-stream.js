export const config = { runtime: "nodejs" };
import { discoverModel } from "./_gemini.js";

function parseJSON(req){
  return new Promise(res=>{
    let d=""; req.on("data",c=>d+=c);
    req.on("end",()=>{ try{res(JSON.parse(d||"{}"))}catch{res({})} });
  });
}

/**
 * Robust stream adapter:
 * - Calls Gemini streamGenerateContent
 * - Parses NDJSON chunks
 * - Emits clean SSE lines: data: {"text":"<delta>"}
 */
export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).end("Method Not Allowed");

  const apiKey = process.env.GEMINI_API_KEY;
  if(!apiKey) return res.status(503).end("GEMINI_API_KEY missing");

  try{
    const { query="", context="" } = await parseJSON(req);
    const pick = await discoverModel(apiKey);

    const url = `https://generativelanguage.googleapis.com/${pick.version}/models/${pick.model}:streamGenerateContent?key=${apiKey}`;
    const system = "You are a precise cybersecurity tutor. Answer directly in 2–4 short sentences. No operational hacking instructions.";
    const prompt = `${system}\n\nQuestion: ${String(query).trim()}\nContext: ${String(context||"").trim()||"N/A"}\n\nBe concise and specific.`;

    // Prepare SSE
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive"
    });

    const upstream = await fetch(url, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({
        contents:[{ role:"user", parts:[{ text: prompt }]}],
        generationConfig:{ temperature:0.2, maxOutputTokens:140 }
      })
    });

    if(!upstream.ok){
      const err = await upstream.text();
      res.write(`event: error\ndata: ${JSON.stringify({ status: upstream.status, details: err.slice(0,200) })}\n\n`);
      return res.end();
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while(true){
      const { value, done } = await reader.read();
      if(done) break;
      buffer += decoder.decode(value, { stream: true });

      // Gemini returns NDJSON (one JSON object per line)
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep last partial line

      for(const line of lines){
        const trimmed = line.trim();
        if(!trimmed) continue;
        try{
          const obj = JSON.parse(trimmed);
          // Try to extract the incremental text from this chunk
          const parts = obj?.candidates?.[0]?.content?.parts || [];
          const piece = parts.map(p => p?.text || "").join("");
          if (piece) {
            // Emit a clean SSE event the client can parse easily
            res.write(`data: ${JSON.stringify({ text: piece })}\n\n`);
          }
        }catch{
          // ignore non-JSON keep-alives
        }
      }
    }

    // Flush any final JSON in buffer
    const last = buffer.trim();
    if(last){
      try{
        const obj = JSON.parse(last);
        const parts = obj?.candidates?.[0]?.content?.parts || [];
        const piece = parts.map(p => p?.text || "").join("");
        if(piece) res.write(`data: ${JSON.stringify({ text: piece })}\n\n`);
      }catch{/* ignore */}
    }

    res.end();
  }catch(e){
    res.write(`event: error\ndata: ${JSON.stringify({ error: String(e) })}\n\n`);
    res.end();
  }
}
