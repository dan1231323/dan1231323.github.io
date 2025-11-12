const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let x = 140, y = 140, size = 20;

document.addEventListener('keydown', e => {
  if(e.key === 'ArrowUp') y -= 10;
  if(e.key === 'ArrowDown') y += 10;
  if(e.key === 'ArrowLeft') x -= 10;
  if(e.key === 'ArrowRight') x += 10;
  draw();
});

function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = 'skyblue';
  ctx.fillRect(x,y,size,size);
}

draw();
