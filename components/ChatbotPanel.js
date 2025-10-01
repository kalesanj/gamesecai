// /components/ChatbotPanel.js
export function mountChatbot(el) {
  function render(lines = []) {
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
  render(chat);

  async function submitAsk() {
    const inp = document.getElementById("askInput");
    const query = (inp.value || "").trim();
    if (!query) return;
    inp.value = "";
    chat.push({ role: "user", text: query });
    render(chat);

    const context = window.__currentQuizQuestion || "";

    try {
      const r = await fetch("/api/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, context })
      });
      const raw = await r.text();
      let j; try { j = JSON.parse(raw); } catch { j = { error: raw }; }

      const text = j.text || j.error || j.details || "Gemini didn’t return text.";
      const source = j.source || (j.error ? "gemini-error" : "gemini");
      chat.push({ role: "ai", text, source });
      render(chat);
    } catch (e) {
      chat.push({ role: "ai", text: `Network error: ${String(e)}`, source: "network" });
      render(chat);
    }
  }

  // Support one-click “Ask AI” from the quiz
  window.addEventListener("ask-ai", (e) => {
    const q = (e.detail?.query || e.detail?.term || "").trim();
    if (!q) return;
    document.getElementById("askInput").value = q;
    submitAsk();
  });

  return { appendAI(){ /* no-op */ } };
}
