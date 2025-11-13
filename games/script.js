import React, { useEffect, useRef, useState } from 'react';

const MazeGame = () => {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState('playing');
  const [time, setTime] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;

    // Игрок
    const player = {
      x: 1.5,
      y: 1.5,
      angle: 0,
      speed: 0.05,
      rotSpeed: 0.05
    };

    // Лабиринт
    const maze = [
      [1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,1,0,0,0,0,1],
      [1,0,1,0,1,0,1,1,0,1],
      [1,0,1,0,0,0,0,1,0,1],
      [1,0,1,1,1,1,0,1,0,1],
      [1,0,0,0,0,0,0,1,0,1],
      [1,1,1,0,1,1,1,1,0,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,0,1,1,1,1,1,1,2,1],
      [1,1,1,1,1,1,1,1,1,1]
    ];

    const keys = {};
    let animationId;
    let startTime = Date.now();

    // Обработка клавиш
    const handleKeyDown = e => keys[e.key.toLowerCase()] = true;
    const handleKeyUp = e => keys[e.key.toLowerCase()] = false;

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Проверка столкновений
    const checkCollision = (x, y) => {
      const mapX = Math.floor(x);
      const mapY = Math.floor(y);
      if (mapX < 0 || mapX >= maze[0].length || mapY < 0 || mapY >= maze.length) return true;
      return maze[mapY][mapX] === 1;
    };

    // Проверка финиша
    const checkFinish = (x, y) => {
      const mapX = Math.floor(x);
      const mapY = Math.floor(y);
      return maze[mapY][mapX] === 2;
    };

    // Raycasting
    const castRay = angle => {
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      let dist = 0;
      while (dist < 20) {
        dist += 0.05;
        const x = player.x + cos * dist;
        const y = player.y + sin * dist;
        const mapX = Math.floor(x);
        const mapY = Math.floor(y);
        if (mapX < 0 || mapX >= maze[0].length || mapY < 0 || mapY >= maze.length) return { dist, isFinish: false };
        if (maze[mapY][mapX] === 1) return { dist, isFinish: false };
        if (maze[mapY][mapX] === 2) return { dist, isFinish: true };
      }
      return { dist: 20, isFinish: false };
    };

    // Облака
    const clouds = Array.from({ length: 5 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * (canvas.height / 3),
      size: 50 + Math.random() * 50,
      speed: 0.2 + Math.random() * 0.3
    }));

    const drawClouds = () => {
      clouds.forEach(cloud => {
        cloud.x += cloud.speed;
        if (cloud.x - cloud.size > canvas.width) cloud.x = -cloud.size;
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.ellipse(cloud.x, cloud.y, cloud.size, cloud.size/2, 0, 0, Math.PI*2);
        ctx.fill();
      });
    };

    // Главный цикл
    const gameLoop = () => {
      if (gameState !== 'playing') return;

      setTime(((Date.now() - startTime) / 1000).toFixed(1));

      // Движение
      if (keys['w']) {
        const newX = player.x + Math.cos(player.angle) * player.speed;
        const newY = player.y + Math.sin(player.angle) * player.speed;
        if (!checkCollision(newX, newY)) { player.x = newX; player.y = newY; }
      }
      if (keys['s']) {
        const newX = player.x - Math.cos(player.angle) * player.speed;
        const newY = player.y - Math.sin(player.angle) * player.speed;
        if (!checkCollision(newX, newY)) { player.x = newX; player.y = newY; }
      }
      if (keys['a']) player.angle -= player.rotSpeed;
      if (keys['d']) player.angle += player.rotSpeed;

      if (checkFinish(player.x, player.y)) { setGameState('won'); return; }

      // Фон с градиентом
      const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height / 2);
      skyGradient.addColorStop(0, '#87CEEB');
      skyGradient.addColorStop(1, '#a0d2f0');
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height / 2);

      const floorGradient = ctx.createLinearGradient(0, canvas.height / 2, 0, canvas.height);
      floorGradient.addColorStop(0, '#2d2d2d');
      floorGradient.addColorStop(1, '#1a1a1a');
      ctx.fillStyle = floorGradient;
      ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);

      drawClouds(); // облака

      // Raycasting
      const numRays = 400;
      const fov = Math.PI / 3;

      for (let i = 0; i < numRays; i++) {
        const rayAngle = player.angle - fov / 2 + (fov * i) / numRays;
        const { dist, isFinish } = castRay(rayAngle);
        const correctedDist = dist * Math.cos(rayAngle - player.angle);
        const wallHeight = (canvas.height / correctedDist) * 0.6;

        const brightness = Math.max(30, 255 - dist * 20);
        let color1, color2;
        if (isFinish) {
          color1 = `rgb(${brightness},${brightness*0.8},${brightness*0.2})`;
          color2 = `rgb(${brightness*0.6},${brightness*0.5},${brightness*0.1})`;
        } else {
          color1 = `rgb(${brightness*0.5},${brightness*0.5},${brightness*0.5})`;
          color2 = `rgb(${brightness*0.3},${brightness*0.3},${brightness*0.3})`;
        }

        const wallGradient = ctx.createLinearGradient(0, 0, 0, wallHeight);
        wallGradient.addColorStop(0, color1);
        wallGradient.addColorStop(1, color2);
        ctx.fillStyle = wallGradient;

        const x = (i * canvas.width) / numRays;
        const y = (canvas.height - wallHeight) / 2;
        ctx.fillRect(x, y, canvas.width / numRays + 1, wallHeight);
      }

      animationId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationId);
    };
  }, [gameState]);

  const restart = () => { setGameState('playing'); setTime(0); };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
      <div className="mb-4 text-center">
        <h1 className="text-3xl font-bold text-white mb-2">3D Лабиринт</h1>
        <div className="text-yellow-400 text-xl">Время: {time}с</div>
        <div className="text-gray-300 text-sm mt-2">Управление: W A S D | Цель: найдите желтый финиш</div>
      </div>

      <canvas ref={canvasRef} width={800} height={600} className="border-4 border-gray-700 rounded-lg shadow-2xl" />

      {gameState === 'won' && (
        <div className="mt-6 text-center">
          <div className="text-4xl font-bold text-yellow-400 mb-4">🎉 Победа! 🎉</div>
          <div className="text-2xl text-white mb-4">Время: {time}с</div>
          <button onClick={restart} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition">
            Играть снова
          </button>
        </div>
      )}

      <div className="mt-4 text-gray-400 text-sm">
        <p>💡 Совет: серые стены - обычные, желтые - финиш, облака двигаются на небе</p>
      </div>
    </div>
  );
};

export default MazeGame;
