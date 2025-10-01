export const config = { runtime: "nodejs" };
import { discoverModel, generate } from "./_gemini.js";

function parseJSON(req){return new Promise(r=>{let d="";req.on("data",c=>d+=c);req.on("end",()=>{try{r(JSON.parse(d||"{}"))}catch{r({})}})})}

function localFeedback({ correct, question, chosen, ref, confidence }) {
  const intro = correct ? "✅ Correct. Nice work—your choice aligns with standard best practice."
                        : "❌ Not quite. That choice isn’t safest for this situation.";
  const explain = ref ? ` Why: ${ref}` : " Aim to pause, verify through official channels, and avoid interacting with suspicious links or attachments.";
  const tip = ` Tip: If your confidence was ${confidence}/5, keep practicing and report anything suspicious to IT/security.`;
  return `${intro}${explain}${tip}`;
}

export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).end("Method Not Allowed");
  try{
    const body = await parseJSON(req);
    const correct = !!body.correct;
    const confidence = Number(body.confidence ?? 3);
    const question = String(body.question || "");
    const chosen = String(body.selectedOptionText || "");
    const ref = String(body.explanation || "");

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try{
        const pick = await discoverModel(apiKey);
        const system = "Supportive cybersecurity tutor. Keep to 3–5 sentences. No operational hacking details.";
        const prompt = `${system}

Question: ${question}
User answer: ${chosen}
Correct: ${correct ? "Yes" : "No"}
Confidence (1–5): ${confidence}
Reference (safe): ${ref}

Give brief feedback and one safe tip.`;

        const text = await generate(apiKey, pick, prompt, { temperature: 0.35, maxOutputTokens: 180 });
        return res.status(200).json({ text, source:`gemini:${pick.model}@${pick.version}` });
      }catch{/* fall back to local */}
    }

    return res.status(200).json({ text: localFeedback({ correct, question, chosen, ref, confidence }), source:"local" });
  }catch{
    return res.status(200).json({ text: localFeedback({ correct:false, question:"", chosen:"", ref:"", confidence:3 }), source:"local-error" });
  }
}
