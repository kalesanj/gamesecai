function now() { return performance.now(); }

const POOLS = {
  easy: [
    {
      id:"e1",
      text:"An email from an unknown sender asks you to click a link to 'verify your account'. What is the safest first step?",
      options:[
        {id:"a",text:"Click the link quickly before it expires"},
        {id:"b",text:"Report it to IT/security team"},
        {id:"c",text:"Reply and ask who they are"},
        {id:"d",text:"Forward to friends for advice"}
      ],
      correct:"b",
      explanation:"Unsolicited verification links are classic phishing. Reporting contains the threat."
    },
    {
      id:"e2",
      text:"A USB drive is found near your desk at work. What should you do?",
      options:[
        {id:"a",text:"Plug it in and see what's inside"},
        {id:"b",text:"Give it to IT/security"},
        {id:"c",text:"Take it home"},
        {id:"d",text:"Throw it in the trash"}
      ],
      correct:"b",
      explanation:"Unknown USBs may carry malware; IT can handle safely."
    }
  ],
  medium: [
    {
      id:"m1",
      text:"A site’s URL shows 'paypaI.com' (capital i) instead of 'paypal.com'. The padlock icon is present. Best action?",
      options:[
        {id:"a",text:"Proceed because there is a padlock"},
        {id:"b",text:"Leave the site and report the look-alike URL"},
        {id:"c",text:"Enter limited info only"},
        {id:"d",text:"Bookmark for later"}
      ],
      correct:"b",
      explanation:"Homograph domains trick users; padlock only means encrypted, not legitimate."
    },
    {
      id:"m2",
      text:"You receive an MFA code you didn’t request. What does this suggest?",
      options:[
        {id:"a",text:"Your account might be targeted; change password and review activity"},
        {id:"b",text:"It’s harmless spam"},
        {id:"c",text:"Someone gifted you a login"},
        {id:"d",text:"Ignore; codes expire anyway"}
      ],
      correct:"a",
      explanation:"Unexpected MFA codes can indicate credential stuffing attempts."
    }
  ],
  hard: [
    {
      id:"h1",
      text:"Colleague sends an invoice (.xlsm macro) from a new vendor with urgency. What is safest immediate action?",
      options:[
        {id:"a",text:"Open it; it’s from a colleague"},
        {id:"b",text:"Validate via out-of-band (phone/chat) before opening"},
        {id:"c",text:"Disable antivirus to open faster"},
        {id:"d",text:"Forward it company-wide"}
      ],
      correct:"b",
      explanation:"Macro docs can deliver malware; verify through independent channel first."
    }
  ]
};

export function mountQuiz(el, { onShowFeedback, onFinish }) {
  const state = {
    pool: "easy",
    asked: new Set(),
    total: 6,
    answered: 0,
    correctCount: 0,
    startTs: 0
  };

  function pickQuestion() {
    let list = POOLS[state.pool] || POOLS.medium;
    const q = list.find(x => !state.asked.has(x.id)) || list[0];
    return q;
  }
  function adaptDifficulty({ correct, confidence }) {
    if (correct && confidence >= 4) state.pool = state.pool === "easy" ? "medium" : "hard";
    else if (!correct || confidence <= 2) state.pool = state.pool === "hard" ? "medium" : "easy";
  }

  function renderQuestion(q) {
    state.startTs = now();
    el.innerHTML = `
      <div>
        <div style="opacity:.7;margin-bottom:8px;">
          Question ${state.answered + 1} of ${state.total} • Pool: ${state.pool}
        </div>
        <h2 style="margin-top:0">${q.text}</h2>
        <div id="options" style="display:grid;gap:8px;margin:12px 0">
          ${q.options.map(o => `
            <label style="display:flex;gap:10px;border:1px solid #334155;padding:10px;border-radius:10px;cursor:pointer;">
              <input type="radio" name="opt" value="${o.id}" />
              <span>${o.text}</span>
            </label>
          `).join("")}
        </div>
        <div style="margin:14px 0 8px;">Confidence (1–5)</div>
        <input class="slider" type="range" min="1" max="5" value="3" id="confidence" />
        <div style="display:flex;gap:8px;margin-top:16px;">
          <button id="askAI" class="ghost">Ask AI</button>
          <button id="submit">Submit</button>
        </div>
      </div>
    `;

    document.getElementById("askAI").onclick = () => {
      const term = prompt('Ask AI to explain a term (e.g., "phishing", "MFA")');
      if (!term) return;
      window.dispatchEvent(new CustomEvent("ask-ai", { detail: { term } }));
    };

    document.getElementById("submit").onclick = async () => {
      const selected = el.querySelector('input[name="opt"]:checked');
      if (!selected) { alert("Pick an option."); return; }
      const confidence = Number(document.getElementById("confidence").value);
      const hesitationMs = Math.max(0, now() - state.startTs);
      const correct = selected.value === q.correct;

      state.answered += 1;
      state.asked.add(q.id);
      if (correct) state.correctCount += 1;

      const payload = {
        question: q.text,
        selectedOptionText: q.options.find(o => o.id === selected.value).text,
        correct, confidence, hesitationMs, explanation: q.explanation
      };

      try {
        const r = await fetch("/api/answer-feedback", {
          method:"POST", headers:{ "Content-Type":"application/json" },
          body: JSON.stringify(payload)
        });
        const raw = await r.text();
        let j; try { j = JSON.parse(raw); } catch { j = { text: raw }; }
        const feedback = j.text || j.error || j.details || "Good effort!";
        adaptDifficulty({ correct, confidence });
        onShowFeedback({ correct, feedback, next: state.answered < state.total });
      } catch {
        onShowFeedback({ correct, feedback: "Network error. Please try again.", next: state.answered < state.total });
      }
    };
  }

  function next() {
    if (state.answered >= state.total) {
      const scorePct = Math.round((state.correctCount / state.total) * 100);
      onFinish?.({ correct: state.correctCount, total: state.total, scorePct });
      return;
    }
    renderQuestion(pickQuestion());
  }

  next();
  return { next };
}
