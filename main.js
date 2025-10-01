import { mountQuiz } from "./components/Quiz.js";
import { mountChatbot } from "./components/ChatbotPanel.js";

const quizEl = document.getElementById("quiz");
const chatbotEl = document.getElementById("chatbot");
const resultsEl = document.getElementById("results");

mountChatbot(chatbotEl);

const quiz = mountQuiz(quizEl, {
  onShowFeedback: ({ correct, feedback, next }) => {
    resultsEl.hidden = false;
    resultsEl.innerHTML = `
      <h3 style="margin:0 0 8px 0;">${correct ? "✅ Correct" : "❌ Not quite"}</h3>
      <p style="margin:0 0 12px 0;">${feedback}</p>
      <button id="next" class="ghost">${next ? "Next Question" : "See Results"}</button>
    `;
    document.getElementById("next").onclick = () => {
      resultsEl.hidden = true;
      quiz.next();
    };
  },
  onFinish: ({ correct, total, scorePct }) => {
    resultsEl.hidden = false;
    resultsEl.innerHTML = `
      <h3>🎯 Final Score: ${scorePct}%</h3>
      <p>Correct: ${correct}/${total}</p>
      <button id="restart" class="ghost">Restart Session</button>
    `;
    document.getElementById("restart").onclick = () => location.reload();
  }
});
