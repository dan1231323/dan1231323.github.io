const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatBox = document.getElementById('chat-box');

chatForm.addEventListener('submit', async e => {
  e.preventDefault();
  const userMsg = chatInput.value;
  chatBox.innerHTML += `<p><strong>Ты:</strong> ${userMsg}</p>`;
  chatInput.value = '';

  chatBox.innerHTML += `<p><strong>ИИ:</strong> ...загрузка</p>`;

  try {
    const response = await fetch('https://api-inference.huggingface.co/models/gpt2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: userMsg })
    });
    const data = await response.json();
    const botMsg = data[0]?.generated_text || "Извини, ответа нет";
    chatBox.innerHTML = chatBox.innerHTML.replace('...загрузка', botMsg);
  } catch (err) {
    chatBox.innerHTML = chatBox.innerHTML.replace('...загрузка', 'Ошибка при подключении к ИИ');
  }

  chatBox.scrollTop = chatBox.scrollHeight;
});
