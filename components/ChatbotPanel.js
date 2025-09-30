// components/ChatbotPanel.js
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
    const term = (e.detail.term || "").trim();
    if (!term) return;

    chat.push({ role: "user", text: `What is "${term}"?` });
    render(chat);

    // Browser-side cache (saves free API calls)
    try {
      const key = `def:${term.toLowerCase()}`;
      const cached = localStorage.getItem(key);
      if (cached) {
        chat.push({ role: "ai", text: cached });
        return render(chat);
      }

      const r = await fetch("/api/ask-definition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term })
      });

      // Try to parse JSON; if not JSON, show raw text
      let j, raw;
      try {
        raw = await r.text();
        j = JSON.parse(raw);
      } catch {
        j = { error: raw || "Non-JSON response from server." };
      }

      // Show helpful message if backend returned an error
      const msg =
        (j && (j.text || j.error || j.details)) ||
        (r.ok ? "I couldn't find a safe definition." : `Request failed (status ${r.status}).`);

      // Cache only successful text responses
      if (j && j.text) {
        localStorage.setItem(key, j.text);
      }

      chat.push({ role: "ai", text: msg });
      render(chat);
    } catch (err) {
      chat.push({ role: "ai", text: `Network error: ${String(err && err.message || err)}` });
      render(chat);
    }
  });

  // API so other components can append messages
  return {
    appendAI(text) {
      chat.push({ role: "ai", text });
      render(chat);
    }
  };
}
