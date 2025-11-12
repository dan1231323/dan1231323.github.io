const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatBox = document.getElementById('chat-box');

// Публичный бесплатный endpoint Brainshop.ai
const BRAINSHOP_API = "http://api.brainshop.ai/get?bid=174980&key=demo&uid=1&msg=";

chatForm.addEventListener('submit', async e => {
  e.preventDefault();
  const userMsg = chatInput.value;
  chatBox.innerHTML += `<p><strong>Ты:</strong> ${userMsg}</p>`;
  chatInput.value = '';
  chatBox.innerHTML += `<p><strong>ИИ:</strong> ...загрузка</p>`;

  try {
    const response = await fetch(BRAINSHOP_API + encodeURIComponent(userMsg));
    const data = await response.json();
    const botMsg = data.cnt || "Извини, ответа нет";
    chatBox.innerHTML = chatBox.innerHTML.replace('...загрузка', botMsg);
  } catch (err) {
    chatBox.innerHTML = chatBox.innerHTML.replace('...загрузка', 'Ошибка при подключении к ИИ');
  }

  chatBox.scrollTop = chatBox.scrollHeight;
});
