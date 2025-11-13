import React, { useEffect, useRef, useState } from 'react';

const MazeDoom = () => {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState('playing');
  const [time, setTime] = useState(0);
  const [health, setHealth] = useState(100);
  const [ammo, setAmmo] = useState(10);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;

    const cellSize = 1;
    const mazeSize = 10;
    const maze = [];

    // --- Процедурная генерация лабиринта ---
    const generateMaze = () => {
      for (let y = 0; y < mazeSize; y++) {
        maze[y] = [];
        for (let x = 0; x < mazeSize; x++) {
          if (y === 0 || y === mazeSize - 1 || x === 0 || x === mazeSize - 1) {
            maze[y][x] = 1; // границы
          } else {
            maze[y][x] = Math.random() < 0.25 ? 1 : 0; // стены и путь
          }
        }
      }
      maze[mazeSize-2][mazeSize-2] = 2; // финиш
    };
    generateMaze();

    const player = { x: 1.5, y: 1.5, angle: 0, speed: 0.05, rotSpeed: 0.05 };

    const keys = {};
    const bullets = [];
    const enemies = [];

    // --- Враги ---
    for (let i = 0; i < 3; i++) {
      enemies.push({ x: Math.random() * (mazeSize-2)+1, y: Math.random()*(mazeSize-2)+1, alive:true });
    }

    // --- Облака ---
    const clouds = Array.from({ length: 5 }, () => ({
      x: Math.random()*canvas.width,
      y: Math.random()*(canvas.height/3),
      size: 50 + Math.random()*50,
      speed: 0.2 + Math.random()*0.3
    }));

    // --- Контроль ---
    const handleKeyDown = e => keys[e.key.toLowerCase()] = true;
    const handleKeyUp = e => keys[e.key.toLowerCase()] = false;
    const handleClick = () => {
      if(ammo > 0){
        bullets.push({x: player.x, y: player.y, angle: player.angle, speed: 0.2});
        setAmmo(a=>a-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('click', handleClick);

    let animationId;
    let startTime = Date.now();

    const checkCollision = (x, y) => {
      const mapX = Math.floor(x);
      const mapY = Math.floor(y);
      if (mapX < 0 || mapX >= mazeSize || mapY < 0 || mapY >= mazeSize) return true;
      return maze[mapY][mapX] === 1;
    };
    const checkFinish = (x, y) => maze[Math.floor(y)][Math.floor(x)]===2;

    const castRay = angle => {
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      let dist = 0;
      while(dist<20){
        dist+=0.05;
        const x = player.x + cos*dist;
        const y = player.y + sin*dist;
        const mapX = Math.floor(x);
        const mapY = Math.floor(y);
        if(mapX<0||mapX>=mazeSize||mapY<0||mapY>=mazeSize) return {dist,isFinish:false};
        if(maze[mapY][mapX]===1) return {dist,isFinish:false};
        if(maze[mapY][mapX]===2) return {dist,isFinish:true};
      }
      return {dist:20,isFinish:false};
    };

    const drawClouds = () => {
      clouds.forEach(c=>{
        c.x+=c.speed;
        if(c.x-c.size>canvas.width) c.x=-c.size;
        ctx.fillStyle='rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.ellipse(c.x,c.y,c.size,c.size/2,0,0,Math.PI*2);
        ctx.fill();
      });
    };

    const gameLoop = () => {
      if(gameState!=='playing') return;
      setTime(((Date.now()-startTime)/1000).toFixed(1));

      // --- Движение игрока ---
      if(keys['w']){
        const nx = player.x + Math.cos(player.angle)*player.speed;
        const ny = player.y + Math.sin(player.angle)*player.speed;
        if(!checkCollision(nx,ny)) {player.x=nx; player.y=ny;}
      }
      if(keys['s']){
        const nx = player.x - Math.cos(player.angle)*player.speed;
        const ny = player.y - Math.sin(player.angle)*player.speed;
        if(!checkCollision(nx,ny)) {player.x=nx; player.y=ny;}
      }
      if(keys['a']) player.angle-=player.rotSpeed;
      if(keys['d']) player.angle+=player.rotSpeed;

      if(checkFinish(player.x,player.y)){setGameState('won'); return;}

      // --- Обновление пуль ---
      bullets.forEach((b,i)=>{
        b.x += Math.cos(b.angle)*b.speed;
        b.y += Math.sin(b.angle)*b.speed;
        if(checkCollision(b.x,b.y)) bullets.splice(i,1);
        enemies.forEach(e=>{
          if(e.alive && Math.hypot(e.x-b.x,e.y-b.y)<0.3){ e.alive=false; bullets.splice(i,1);}
        });
      });

      // --- Движение врагов ---
      enemies.forEach(e=>{
        if(!e.alive) return;
        const dx=player.x-e.x; const dy=player.y-e.y;
        const dist=Math.hypot(dx,dy);
        if(dist>0.5){
          const nx = e.x + (dx/dist)*0.01;
          const ny = e.y + (dy/dist)*0.01;
          if(!checkCollision(nx,ny)){ e.x=nx; e.y=ny;}
        }else{
          setHealth(h=>Math.max(0,h-0.5));
          if(health<=0) setGameState('lost');
        }
      });

      // --- Отрисовка ---
      const skyGradient = ctx.createLinearGradient(0,0,0,canvas.height/2);
      skyGradient.addColorStop(0,'#87CEEB');
      skyGradient.addColorStop(1,'#a0d2f0');
      ctx.fillStyle=skyGradient;
      ctx.fillRect(0,0,canvas.width,canvas.height/2);

      const floorGradient = ctx.createLinearGradient(0,canvas.height/2,0,canvas.height);
      floorGradient.addColorStop(0,'#2d2d2d');
      floorGradient.addColorStop(1,'#1a1a1a');
      ctx.fillStyle=floorGradient;
      ctx.fillRect(0,canvas.height/2,canvas.width,canvas.height/2);

      drawClouds();

      // --- Raycasting 2.5D ---
      const numRays=300;
      const fov=Math.PI/3;
      for(let i=0;i<numRays;i++){
        const rayAngle = player.angle - fov/2 + (fov*i)/numRays;
        const {dist,isFinish}=castRay(rayAngle);
        const correctedDist = dist*Math.cos(rayAngle-player.angle);
        const wallHeight = (canvas.height/correctedDist)*0.6;
        const brightness = Math.max(30,255 - dist*20);
        let color1,color2;
        if(isFinish){ color1=`rgb(${brightness},${brightness*0.8},${brightness*0.2})`; color2=`rgb(${brightness*0.6},${brightness*0.5},${brightness*0.1})`; }
        else{ color1=`rgb(${brightness*0.5},${brightness*0.5},${brightness*0.5})`; color2=`rgb(${brightness*0.3},${brightness*0.3},${brightness*0.3})`; }
        const wallGradient=ctx.createLinearGradient(0,0,0,wallHeight);
        wallGradient.addColorStop(0,color1);
        wallGradient.addColorStop(1,color2);
        ctx.fillStyle=wallGradient;
        const x = (i*canvas.width)/numRays;
        const y = (canvas.height-wallHeight)/2;
        ctx.fillRect(x,y,canvas.width/numRays+1,wallHeight);
      }

      // --- Отрисовка пуль ---
      bullets.forEach(b=>{
        const screenX = canvas.width/2 + (b.x-player.x)*50;
        const screenY = canvas.height/2 + (b.y-player.y)*50;
        ctx.fillStyle='yellow';
        ctx.beginPath();
        ctx.arc(screenX,screenY,3,0,Math.PI*2);
        ctx.fill();
      });

      // --- Враги ---
      enemies.forEach(e=>{
        if(!e.alive) return;
        const screenX = canvas.width/2 + (e.x-player.x)*50;
        const screenY = canvas.height/2 + (e.y-player.y)*50;
        ctx.fillStyle='red';
        ctx.beginPath();
        ctx.arc(screenX,screenY,10,0,Math.PI*2);
        ctx.fill();
      });

      // --- Пистолет ---
      ctx.fillStyle='black';
      ctx.fillRect(canvas.width/2-10,canvas.height-80,20,60);
      ctx.fillStyle='gray';
      ctx.fillRect(canvas.width/2-5,canvas.height-100,10,20);

      animationId=requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('click', handleClick);
      cancelAnimationFrame(animationId);
    };
  }, [gameState, health, ammo, time]);

  const restart=()=>{
    setGameState('playing');
    setTime(0);
    setHealth(100);
    setAmmo(10);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
      <div className="mb-4 text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Mini-Doom 2.5D</h1>
        <div className="text-yellow-400 text-xl">Время: {time}s | Здоровье: {Math.floor(health)} | Патроны: {ammo}</div>
        <div className="text-gray-300 text-sm mt-2">W A S D - движение | Click - выстрел | Цель: найти финиш</div>
      </div>

      <canvas ref={canvasRef} width={800} height={600} className="border-4 border-gray-700 rounded-lg shadow-2xl" />

      {gameState==='won' && (
        <div className="mt-6 text-center">
          <div className="text-4xl font-bold text-yellow-400 mb-4">🎉 Победа! 🎉</div>
          <button onClick={restart} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition">Играть снова</button>
        </div>
      )}
      {gameState==='lost' && (
        <div className="mt-6 text-center">
          <div className="text-4xl font-bold text-red-600 mb-4">💀 Вы погибли!</div>
          <button onClick={restart} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition">Попробовать снова</button>
        </div>
      )}
    </div>
  );
};

export default MazeDoom;
