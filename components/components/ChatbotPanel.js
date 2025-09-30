export function mountChatbot(el) {
  function render(lines=[]) {
    el.innerHTML = `
      <h3>AI Assistant</h3>
      <div id="log" style="display:flex;flex-direction:column;gap:10px;min-height:160px;">
        ${lines.map(l=>`<div><b>${l.role==='user'?'You':'AI'}:</b> ${l.text}</div>`).join("")}
      </div>
    `;
  }
  let chat = [];
  render(chat);

  window.addEventListener("ask-ai", async (e) => {
    const term = e.detail.term;
    chat.push({ role:"user", text:`What is "${term}"?` });
    render(chat);

    // browser-side cache to save free API calls
    const key = `def:${term.toLowerCase()}`;
    const cached = localStorage.getItem(key);
    if (cached) {
      chat.push({ role:"ai", text: cached });
      return render(chat);
    }

    const r = await fetch("/api/ask-definition", {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ term })
    });
    const j = await r.json();
    const text = j.text || "I couldn't find a safe definition.";
    localStorage.setItem(key, text);
    chat.push({ role:"ai", text });
    render(chat);
  });

  return { appendAI(text){ chat.push({role:"ai", text}); render(chat);} };
}
