import React, { useEffect, useRef, useState } from 'react';

const MazeGame = () => {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState('playing');
  const [time, setTime] = useState(0);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Настройки игрока
    const player = {
      x: 1.5,
      y: 1.5,
      angle: 0,
      speed: 0.05,
      rotSpeed: 0.05
    };
    
    // Лабиринт (1 = стена, 0 = путь, 2 = финиш)
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
    const handleKeyDown = (e) => {
      keys[e.key.toLowerCase()] = true;
    };
    
    const handleKeyUp = (e) => {
      keys[e.key.toLowerCase()] = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Проверка столкновений
    const checkCollision = (x, y) => {
      const mapX = Math.floor(x);
      const mapY = Math.floor(y);
      if (mapX < 0 || mapX >= maze[0].length || mapY < 0 || mapY >= maze.length) {
        return true;
      }
      return maze[mapY][mapX] === 1;
    };
    
    // Проверка финиша
    const checkFinish = (x, y) => {
      const mapX = Math.floor(x);
      const mapY = Math.floor(y);
      return maze[mapY][mapX] === 2;
    };
    
    // Отрисовка луча (raycasting)
    const castRay = (angle) => {
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      let dist = 0;
      
      while (dist < 20) {
        dist += 0.1;
        const x = player.x + cos * dist;
        const y = player.y + sin * dist;
        
        const mapX = Math.floor(x);
        const mapY = Math.floor(y);
        
        if (mapX < 0 || mapX >= maze[0].length || mapY < 0 || mapY >= maze.length) {
          return { dist, isFinish: false };
        }
        
        if (maze[mapY][mapX] === 1) {
          return { dist, isFinish: false };
        }
        
        if (maze[mapY][mapX] === 2) {
          return { dist, isFinish: true };
        }
      }
      
      return { dist: 20, isFinish: false };
    };
    
    // Основной игровой цикл
    const gameLoop = () => {
      if (gameState !== 'playing') return;
      
      // Обновление времени
      setTime(((Date.now() - startTime) / 1000).toFixed(1));
      
      // Движение
      if (keys['w']) {
        const newX = player.x + Math.cos(player.angle) * player.speed;
        const newY = player.y + Math.sin(player.angle) * player.speed;
        if (!checkCollision(newX, newY)) {
          player.x = newX;
          player.y = newY;
        }
      }
      if (keys['s']) {
        const newX = player.x - Math.cos(player.angle) * player.speed;
        const newY = player.y - Math.sin(player.angle) * player.speed;
        if (!checkCollision(newX, newY)) {
          player.x = newX;
          player.y = newY;
        }
      }
      if (keys['a']) {
        player.angle -= player.rotSpeed;
      }
      if (keys['d']) {
        player.angle += player.rotSpeed;
      }
      
      // Проверка финиша
      if (checkFinish(player.x, player.y)) {
        setGameState('won');
        return;
      }
      
      // Отрисовка
      ctx.fillStyle = '#87CEEB';
      ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
      ctx.fillStyle = '#2d2d2d';
      ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);
      
      // Raycasting
      const numRays = 120;
      const fov = Math.PI / 3;
      
      for (let i = 0; i < numRays; i++) {
        const rayAngle = player.angle - fov / 2 + (fov * i) / numRays;
        const { dist, isFinish } = castRay(rayAngle);
        
        const correctedDist = dist * Math.cos(rayAngle - player.angle);
        const wallHeight = (canvas.height / correctedDist) * 0.6;
        
        const brightness = Math.max(50, 255 - dist * 30);
        
        if (isFinish) {
          ctx.fillStyle = `rgb(${brightness}, ${brightness * 0.8}, ${brightness * 0.2})`;
        } else {
          ctx.fillStyle = `rgb(${brightness * 0.5}, ${brightness * 0.5}, ${brightness * 0.5})`;
        }
        
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
  
  const restart = () => {
    setGameState('playing');
    setTime(0);
  };
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
      <div className="mb-4 text-center">
        <h1 className="text-3xl font-bold text-white mb-2">3D Лабиринт</h1>
        <div className="text-yellow-400 text-xl">Время: {time}с</div>
        <div className="text-gray-300 text-sm mt-2">
          Управление: W A S D | Цель: найдите желтый финиш
        </div>
      </div>
      
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="border-4 border-gray-700 rounded-lg shadow-2xl"
      />
      
      {gameState === 'won' && (
        <div className="mt-6 text-center">
          <div className="text-4xl font-bold text-yellow-400 mb-4">
            🎉 Победа! 🎉
          </div>
          <div className="text-2xl text-white mb-4">
            Время: {time}с
          </div>
          <button
            onClick={restart}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition"
          >
            Играть снова
          </button>
        </div>
      )}
      
      <div className="mt-4 text-gray-400 text-sm">
        <p>💡 Совет: серые стены - обычные, желтые - финиш</p>
      </div>
    </div>
  );
};

export default MazeGame;
