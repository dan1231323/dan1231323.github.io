const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatBox = document.getElementById('chat-box');

const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions";
const API_KEY = "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";

chatForm.addEventListener('submit', async e => {
  e.preventDefault();
  const userMsg = chatInput.value;
  chatBox.innerHTML += `<p><strong>Ты:</strong> ${userMsg}</p>`;
  chatInput.value = '';
  chatBox.innerHTML += `<p><strong>ИИ:</strong> ...загрузка</p>`;

  try {
    const response = await fetch(OPENROUTER_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-mini",  // лёгкая англ. модель, немного понимает русский
        messages: [{ role: "user", content: userMsg }]
      })
    });

    const data = await response.json();
    const botMsg = data.choices?.[0]?.message?.content || "Извини, ответа нет";
    chatBox.innerHTML = chatBox.innerHTML.replace('...загрузка', botMsg);
  } catch (err) {
    chatBox.innerHTML = chatBox.innerHTML.replace('...загрузка', 'Ошибка при подключении к ИИ');
  }

  chatBox.scrollTop = chatBox.scrollHeight;
});
