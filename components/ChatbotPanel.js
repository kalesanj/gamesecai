// /components/ChatbotPanel.js
export function mountChatbot(el) {
  function ui(lines = []) {
    el.innerHTML = `
      <h3>AI Assistant</h3>
      <div style="display:flex;gap:8px;margin:8px 0;">
        <input id="askInput" placeholder="Ask anything about cybersecurity…" style="flex:1;padding:8px;border-radius:8px;border:1px solid #334155;background:#0b1324;color:#e2e8f0" />
        <button id="askBtn" class="ghost">Ask</button>
      </div>
      <div id="log" style="display:flex;flex-direction:column;gap:10px;min-height:160px;">
        ${lines.map(l => `
          <div>
            <b>${l.role === "user" ? "You" : "AI"}${l.source ? ` <span style="opacity:.6">[${l.source}]</span>` : ""}:</b>
            ${l.text}
          </div>
        `).join("")}
      </div>
    `;
    document.getElementById("askBtn").onclick = submitAsk;
    document.getElementById("askInput").onkeydown = (e)=>{ if(e.key==="Enter") submitAsk(); };
  }

  let chat = [];
  ui(chat);

  async function submitAsk() {
    const inp = document.getElementById("askInput");
    const query = (inp.value || "").trim();
    if (!query) return;
    inp.value = "";
    chat.push({ role: "user", text: query });
    ui(chat);

    // optional context: current quiz question (if app sets it)
    const ctx = window.__currentQuizQuestion || "";

    try {
      const r = await fetch("/api/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, context: ctx })
      });
      const raw = await r.text();
      let j; try { j = JSON.parse(raw); } catch { j = { text: raw }; }
      const msg = j.text || j.error || j.details || "I couldn't find a safe explanation.";
      chat.push({ role: "ai", text: msg, source: j.source || (j.error ? "error" : "unknown") });
      ui(chat);
    } catch (e) {
      chat.push({ role: "ai", text: "Network error. Please try again.", source: "network" });
      ui(chat);
    }
  }

  // Also listen for “Ask AI” from the quiz (pre-fills input then asks)
  window.addEventListener("ask-ai", (e) => {
    const q = (e.detail?.query || e.detail?.term || "").trim();
    if (!q) return;
    document.getElementById("askInput").value = q;
    submitAsk();
  });

  return { appendAI(){ /* no-op: quiz feedback stays below, not in chat */ } };
}
