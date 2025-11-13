// script.js — простые мини-игры: Угадай число и Тест реакции
document.addEventListener('DOMContentLoaded', function(){
  // Угадай число
  const startGuessBtn = document.getElementById('start-guess');
  const guessArea = document.getElementById('guess-area');
  let secret = null, attempts = 0;

  function startGuessGame(){
    secret = Math.floor(Math.random() * 100) + 1;
    attempts = 0;
    guessArea.innerHTML = '<p>Загадано число от 1 до 100. Введите ваш вариант:</p><input id="guess-input" type="number" min="1" max="100" /><button id="guess-send" class="button-ghost">Проверить</button><div id="guess-log"></div>';
    document.getElementById('guess-send').addEventListener('click', checkGuess);
    document.getElementById('guess-input').addEventListener('keydown', function(e){ if(e.key==='Enter') checkGuess(); });
  }

  function checkGuess(){
    const v = Number(document.getElementById('guess-input').value);
    const log = document.getElementById('guess-log');
    if(!v || v < 1 || v > 100){ log.innerHTML = '<p>Введите число от 1 до 100.</p>'; return; }
    attempts++;
    if(v === secret){
      log.innerHTML = '<p>Верно! Вы угадали за ' + attempts + ' попыток.</p>';
    } else if(v < secret){
      log.innerHTML = '<p>Загаданное число больше.</p>';
    } else {
      log.innerHTML = '<p>Загаданное число меньше.</p>';
    }
  }

  startGuessBtn && startGuessBtn.addEventListener('click', startGuessGame);

  // Тест реакции
  const startReactionBtn = document.getElementById('start-reaction');
  const reactionArea = document.getElementById('reaction-area');
  let reactionTimeout = null, startTime = null;

  function startReactionTest(){
    reactionArea.innerHTML = '<p>Подождите... сигнал появится случайно.</p>';
    reactionArea.style.cursor = 'default';
    const delay = 1000 + Math.random() * 3000;
    reactionTimeout = setTimeout(() => {
      reactionArea.innerHTML = '<button id="react-btn" class="cta">ЖМИ!</button>';
      startTime = performance.now();
      document.getElementById('react-btn').addEventListener('click', recordReaction);
    }, delay);
  }

  function recordReaction(){
    const dt = performance.now() - startTime;
    reactionArea.innerHTML = '<p>Ваша реакция: ' + Math.round(dt) + ' мс</p><button id="again" class="button-ghost">Ещё раз</button>';
    document.getElementById('again').addEventListener('click', startReactionTest);
  }

  startReactionBtn && startReactionBtn.addEventListener('click', startReactionTest);
});
