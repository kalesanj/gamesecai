export function mountChatbot(el) {
  function render(lines = []) {
    el.innerHTML = `
      <h3>AI Assistant</h3>
      <div id="log" style="display:flex;flex-direction:column;gap:10px;min-height:160px;">
        ${lines.map(l => `<div><b>${l.role === "user" ? "You" : "AI"}:</b> ${l.text}</div>`).join("")}
      </div>
    `;
  }

  let chat = [];
  render(chat);

  window.addEventListener("ask-ai", async (e) => {
    const query = (e.detail.query || e.detail.term || "").trim();
    const context = (e.detail.context || "").trim();
    if (!query) return;

    chat.push({ role: "user", text: query });
    render(chat);

    try {
      const key = `learn:${query.toLowerCase()}`;
      const cached = localStorage.getItem(key);
      if (cached) { chat.push({ role: "ai", text: cached }); return render(chat); }

      const r = await fetch("/api/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, context })
      });

      const raw = await r.text();
      let j; try { j = JSON.parse(raw); } catch { j = { text: raw }; }
      const msg = j.text || j.error || j.details || "I couldn't find a safe explanation.";
      if (j.text) localStorage.setItem(key, j.text);

      chat.push({ role: "ai", text: msg });
      render(chat);
    } catch (err) {
      chat.push({ role: "ai", text: "Network error. Please try again." });
      render(chat);
    }
  });

  // No mirroring of answer feedback into this panel
  return { appendAI(){ /* no-op */ } };
}
