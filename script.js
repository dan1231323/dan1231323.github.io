const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let x = 140, y = 140, size = 20, speed = 4;
let score = 0, combo = 1, timer = 0;

// создаем цель
let target = {
  x: Math.random() * (canvas.width - size),
  y: Math.random() * (canvas.height - size),
  size: 20,
  color: 'red'
};

// создаем препятствия
const obstacles = [];
for(let i = 0; i < 5; i++){
  obstacles.push({
    x: Math.random() * (canvas.width - 30),
    y: Math.random() * (canvas.height - 30),
    width: 30,
    height: 30,
    color: 'grey'
  });
}

// клавиши
const keys = {};
document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);

function update() {
  // движение
  if(keys['ArrowUp']) y -= speed;
  if(keys['ArrowDown']) y += speed;
  if(keys['ArrowLeft']) x -= speed;
  if(keys['ArrowRight']) x += speed;

  // границы
  if(x < 0) x = 0;
  if(y < 0) y = 0;
  if(x + size > canvas.width) x = canvas.width - size;
  if(y + size > canvas.height) y = canvas.height - size;

  // проверка съедения цели
  if(x < target.x + target.size &&
     x + size > target.x &&
     y < target.y + target.size &&
     y + size > target.y) {
       score += 1 * combo;
       combo++;
       timer = 0; // сброс таймера для комбо
       // случайная новая цель
       target.x = Math.random() * (canvas.width - size);
       target.y = Math.random() * (canvas.height - size);
  } else {
      timer++;
      if(timer > 100) combo = 1; // комбо сбрасывается
  }

  // проверка столкновения с препятствиями
  for(let obs of obstacles){
    if(x < obs.x + obs.width &&
       x + size > obs.x &&
       y < obs.y + obs.height &&
       y + size > obs.y) {
         // сброс позиции при столкновении
         x = 50;
         y = 50;
         score = Math.max(0, score - 2);
         combo = 1;
    }
  }

  // ускорение со временем
  if(score % 5 === 0 && score > 0) speed = 4 + Math.min(score/5, 8);

  draw();
  requestAnimationFrame(update);
}

function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // игрок
  ctx.fillStyle = `rgb(${50 + score*5 % 205}, 100, 200)`;
  ctx.fillRect(x, y, size, size);

  // цель
  ctx.fillStyle = target.color;
  ctx.fillRect(target.x, target.y, target.size, target.size);

  // препятствия
  for(let obs of obstacles){
    ctx.fillStyle = obs.color;
    ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
  }

  // счет и комбо
  ctx.fillStyle = 'black';
  ctx.font = '20px Arial';
  ctx.fillText('Score: ' + score, 10, 25);
  if(combo > 1) ctx.fillText('Combo: x' + combo, 10, 50);
}

update();
