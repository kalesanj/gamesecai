export const config = { runtime: "nodejs" };
import { discoverModel } from "./_gemini.js";

function parseJSON(req){return new Promise(r=>{let d="";req.on("data",c=>d+=c);req.on("end",()=>{try{r(JSON.parse(d||"{}"))}catch{r({})}})})}

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).end("Method Not Allowed");
  const apiKey = process.env.GEMINI_API_KEY;
  if(!apiKey) return res.status(503).end("GEMINI_API_KEY missing");

  try{
    const { query="", context="" } = await parseJSON(req);
    const pick = await discoverModel(apiKey);

    const url = `https://generativelanguage.googleapis.com/${pick.version}/models/${pick.model}:streamGenerateContent?key=${apiKey}`;
    const system = "You are a precise cybersecurity tutor. Answer directly in 2–4 short sentences. No operational hacking instructions.";
    const prompt = `${system}\n\nQuestion: ${String(query).trim()}\nContext: ${String(context||"").trim() || "N/A"}\n\nBe concise and specific.`;

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });

    const r = await fetch(url, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({
        contents:[{ role:"user", parts:[{ text: prompt }]}],
        generationConfig:{ temperature:0.2, maxOutputTokens:140 }
      })
    });

    if(!r.ok){
      const err = await r.text();
      res.write(`event: error\ndata: ${JSON.stringify({ status: r.status, details: err.slice(0,200) })}\n\n`);
      return res.end();
    }

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    while(true){
      const { value, done } = await reader.read();
      if(done) break;
      const chunk = decoder.decode(value);
      res.write(`data: ${chunk}\n\n`); // forward Gemini JSON chunks
    }
    res.end();
  }catch(e){
    res.write(`event: error\ndata: ${JSON.stringify({ error: String(e) })}\n\n`);
    res.end();
  }
}
