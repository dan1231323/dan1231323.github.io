(() => {
  const area = document.getElementById('area');
  const startBtn = document.getElementById('start');
  const resetBtn = document.getElementById('reset');
  const timeEl = document.getElementById('time');
  const scoreEl = document.getElementById('score');

  let timer = null, moveTimer = null, timeLeft = 30, score = 0, target = null, running = false;

  function rand(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
  function placeTarget(){
    if (!target) return;
    const pad = 12;
    const areaRect = area.getBoundingClientRect();
    const maxX = Math.max(0, areaRect.width - 56 - pad);
    const maxY = Math.max(0, areaRect.height - 56 - pad);
    const x = rand(pad, maxX);
    const y = rand(pad, maxY);
    target.style.left = x + 'px';
    target.style.top = y + 'px';
  }
  function createTarget(){
    if (target) target.remove();
    target = document.createElement('div');
    target.className = 'target';
    target.textContent = '✦';
    area.appendChild(target);
    placeTarget();
    target.addEventListener('click', () => {
      if (!running) return;
      score += 1;
      scoreEl.textContent = score;
      target.style.transform = 'scale(1.15)';
      setTimeout(() => target.style.transform = 'scale(1)', 120);
      placeTarget();
    });
  }
  function startGame(){
    if (running) return;
    running = true;
    score = 0; timeLeft = 30;
    scoreEl.textContent = score;
    timeEl.textContent = timeLeft;
    createTarget();
    moveTimer = setInterval(placeTarget, 900);
    timer = setInterval(() => {
      timeLeft -= 1; timeEl.textContent = timeLeft;
      if (timeLeft <= 0) endGame();
    }, 1000);
  }
  function endGame(){
    running = false;
    clearInterval(timer); clearInterval(moveTimer);
    if (target) target.remove();
    alert('Время вышло! Очки: ' + score);
  }
  function resetGame(){
    running = false;
    clearInterval(timer); clearInterval(moveTimer);
    timeLeft = 30; score = 0;
    timeEl.textContent = timeLeft; scoreEl.textContent = score;
    if (target) target.remove();
  }

  startBtn.addEventListener('click', startGame);
  resetBtn.addEventListener('click', resetGame);
  window.addEventListener('resize', () => { if (target) placeTarget(); });
})();
