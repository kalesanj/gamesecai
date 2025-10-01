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

    const ctx = window.__currentQuizQuestion || "";
    const resp = await fetch("/api/learn-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, context: ctx })
    });

    // If streaming unavailable, try non-streaming endpoint
    if (!resp.ok || !resp.body) {
      const r = await fetch("/api/learn", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ query, context: ctx })
      });
      const raw = await r.text(); let j; try{ j=JSON.parse(raw);}catch{ j={ error: raw }; }
      chat.push({ role:"ai", text: j.text || j.error || "Gemini error", source: "gemini" });
      return ui(chat);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    chat.push({ role: "ai", text: "", source: "gemini" });
    ui(chat);

    let partial = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      partial += decoder.decode(value, { stream: true });

      // Our server sends SSE lines:  data: {"text":"..."}
      const lines = partial.split("\n");
      partial = lines.pop(); // keep last partial for next round

      let appended = false;
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const payload = t.slice(5).trim();
        if (!payload) continue;
        try {
          const obj = JSON.parse(payload);
          const piece = obj.text || "";
          if (piece) {
            const last = chat[chat.length - 1];
            last.text += piece;
            appended = true;
          }
        } catch {/* ignore keep-alives */}
      }
      if (appended) ui(chat);
    }
  }

  // Support the quiz's "Ask AI" button
  window.addEventListener("ask-ai", (e) => {
    const q = (e.detail?.query || e.detail?.term || "").trim();
    if (!q) return;
    document.getElementById("askInput").value = q;
    submitAsk();
  });

  return { appendAI(){ /* no-op */ } };
}
