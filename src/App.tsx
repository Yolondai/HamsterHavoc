/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  RotateCcw, 
  Trophy, 
  AlertTriangle, 
  Heart, 
  Zap, 
  MousePointer2,
  Settings2,
  Info,
  X
} from 'lucide-react';

// --- Types ---

type GameState = 'start' | 'playing' | 'gameover';

interface Hamster {
  id: number;
  x: number;
  y: number;
  size: number;
  state: 'popping' | 'active' | 'chewing' | 'leaving';
  timer: number;
  type: 'normal' | 'fast' | 'heavy';
  color: string;
  rotation: number;
  chewTimer: number;
}

// --- Constants ---

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const HAMSTER_SPAWN_RATE = 1500; // ms
const MAX_DAMAGE = 100;
const BROOM_HIT_RADIUS = 60; // Increased radius

const HAMSTER_TYPES = {
  normal: { color: '#8B4513', size: 40, speed: 1, damage: 0.2, points: 10, eyeSize: 5 },
  fast: { color: '#A0522D', size: 30, speed: 2, damage: 0.1, points: 25, eyeSize: 4 },
  heavy: { color: '#5D2E0C', size: 60, speed: 0.5, damage: 0.5, points: 50, eyeSize: 8 },
};

// --- Components ---

const MenuHamster = ({ color, size, delay = 0, x, y, rotation = 0 }: { color: string, size: number, delay?: number, x: string, y: string, rotation?: number }) => (
  <motion.div
    initial={{ scale: 0, rotate: rotation }}
    animate={{ 
      scale: [0, 1.1, 1],
      y: [0, -10, 0],
      rotate: [rotation, rotation + 5, rotation - 5, rotation]
    }}
    transition={{ 
      scale: { delay, duration: 0.5, ease: "easeOut" },
      y: { repeat: Infinity, duration: 2, ease: "easeInOut", delay },
      rotate: { repeat: Infinity, duration: 3, ease: "easeInOut", delay }
    }}
    style={{ left: x, top: y, position: 'absolute' }}
    className="z-10"
  >
    <div 
      style={{ 
        width: size, 
        height: size * 1.2, 
        backgroundColor: color,
        borderRadius: size * 0.4,
        border: '4px solid black',
        boxShadow: '0 8px 0 rgba(0,0,0,0.2)'
      }}
      className="relative"
    >
      {/* Ears */}
      <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full border-4 border-black" style={{ backgroundColor: color }} />
      <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full border-4 border-black" style={{ backgroundColor: color }} />
      {/* Eyes */}
      <div className="absolute top-1/4 left-1/4 w-3 h-3 bg-black rounded-full" />
      <div className="absolute top-1/4 right-1/4 w-3 h-3 bg-black rounded-full" />
      {/* Nose */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-2 h-2 bg-pink-400 rounded-full" />
    </div>
  </motion.div>
);

export default function App() {
  const [gameState, setGameState] = useState<GameState>('start');
  const [score, setScore] = useState(0);
  const [damage, setDamage] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [showInfo, setShowInfo] = useState(false);

  // Refs for game loop to avoid stale closures
  const gameStateRef = useRef<GameState>('start');
  const scoreRef = useRef(0);
  const damageRef = useRef(0);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hamstersRef = useRef<Hamster[]>([]);
  const lastSpawnRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const lastClickTimeRef = useRef<number>(0);

  // --- Sound Effects ---
  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const playPopSound = useCallback(() => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }, []);

  const playHitSound = useCallback(() => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.15);
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }, []);

  const playChewSound = useCallback(() => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(60, ctx.currentTime);
    osc.frequency.setValueAtTime(80, ctx.currentTime + 0.05);
    
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }, []);

  const playGameOverSound = useCallback(() => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(50, ctx.currentTime + 1);
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 1);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 1);
  }, []);

  // Sync refs with state
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { damageRef.current = damage; }, [damage]);

  // Load High Score
  useEffect(() => {
    const saved = localStorage.getItem('hamster_high_score');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('hamster_high_score', score.toString());
    }
  }, [score, highScore]);

  // --- Game Logic ---

  const spawnHamster = useCallback(() => {
    const types: (keyof typeof HAMSTER_TYPES)[] = ['normal', 'fast', 'heavy'];
    const type = types[Math.floor(Math.random() * types.length)];
    const config = HAMSTER_TYPES[type];

    const newHamster: Hamster = {
      id: Date.now() + Math.random(),
      x: Math.random() * (CANVAS_WIDTH - config.size * 2) + config.size,
      y: Math.random() * (CANVAS_HEIGHT - config.size * 2) + config.size,
      size: config.size,
      state: 'popping',
      timer: 0,
      type,
      color: config.color,
      rotation: (Math.random() - 0.5) * 0.2,
      chewTimer: 0,
    };

    hamstersRef.current.push(newHamster);
    playPopSound();
  }, [playPopSound]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // --- Draw Room Background ---
    // Wall (Gradient for depth)
    const wallGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT * 0.7);
    wallGradient.addColorStop(0, '#E5E5EA');
    wallGradient.addColorStop(1, '#D1D1D6');
    ctx.fillStyle = wallGradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT * 0.7);
    
    // Subtle Wallpaper Pattern (Vertical stripes)
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i < CANVAS_WIDTH; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, CANVAS_HEIGHT * 0.7);
      ctx.stroke();
    }

    // Baseboard
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, CANVAS_HEIGHT * 0.68, CANVAS_WIDTH, CANVAS_HEIGHT * 0.02);
    ctx.strokeStyle = '#C7C7CC';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, CANVAS_HEIGHT * 0.68, CANVAS_WIDTH, CANVAS_HEIGHT * 0.02);

    // Floor (Wood Planks)
    ctx.fillStyle = '#3A2618'; // Dark wood
    ctx.fillRect(0, CANVAS_HEIGHT * 0.7, CANVAS_WIDTH, CANVAS_HEIGHT * 0.3);
    
    // Plank lines
    ctx.strokeStyle = '#2A1B11';
    ctx.lineWidth = 2;
    for (let i = 0; i < CANVAS_WIDTH; i += 60) {
      ctx.beginPath();
      ctx.moveTo(i, CANVAS_HEIGHT * 0.7);
      ctx.lineTo(i, CANVAS_HEIGHT);
      ctx.stroke();
    }
    // Horizontal plank joints
    for (let j = CANVAS_HEIGHT * 0.7; j < CANVAS_HEIGHT; j += 40) {
      for (let i = 0; i < CANVAS_WIDTH; i += 60) {
        if ((Math.floor(j/40) + Math.floor(i/60)) % 2 === 0) {
          ctx.beginPath();
          ctx.moveTo(i, j);
          ctx.lineTo(i + 60, j);
          ctx.stroke();
        }
      }
    }

    // Window
    // Outside view (Sky)
    ctx.fillStyle = '#8EBBFF';
    ctx.beginPath();
    const winX = CANVAS_WIDTH * 0.1;
    const winY = CANVAS_HEIGHT * 0.1;
    const winW = 140;
    const winH = 180;
    const winR = 10;
    ctx.moveTo(winX + winR, winY);
    ctx.arcTo(winX + winW, winY, winX + winW, winY + winH, winR);
    ctx.arcTo(winX + winW, winY + winH, winX, winY + winH, winR);
    ctx.arcTo(winX, winY + winH, winX, winY, winR);
    ctx.arcTo(winX, winY, winX + winW, winY, winR);
    ctx.closePath();
    ctx.fill();
    
    // Clouds
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH * 0.1 + 40, CANVAS_HEIGHT * 0.1 + 50, 20, 0, Math.PI * 2);
    ctx.arc(CANVAS_WIDTH * 0.1 + 60, CANVAS_HEIGHT * 0.1 + 40, 25, 0, Math.PI * 2);
    ctx.arc(CANVAS_WIDTH * 0.1 + 90, CANVAS_HEIGHT * 0.1 + 50, 20, 0, Math.PI * 2);
    ctx.fill();

    // Window Frame
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 8;
    ctx.strokeRect(CANVAS_WIDTH * 0.1, CANVAS_HEIGHT * 0.1, 140, 180);
    
    // Window panes
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH * 0.1 + 70, CANVAS_HEIGHT * 0.1);
    ctx.lineTo(CANVAS_WIDTH * 0.1 + 70, CANVAS_HEIGHT * 0.1 + 180);
    ctx.moveTo(CANVAS_WIDTH * 0.1, CANVAS_HEIGHT * 0.1 + 90);
    ctx.lineTo(CANVAS_WIDTH * 0.1 + 140, CANVAS_HEIGHT * 0.1 + 90);
    ctx.stroke();

    // Curtains
    ctx.fillStyle = '#5856D6';
    ctx.beginPath();
    // Left curtain
    ctx.moveTo(CANVAS_WIDTH * 0.1 - 20, CANVAS_HEIGHT * 0.08);
    ctx.quadraticCurveTo(CANVAS_WIDTH * 0.1 + 20, CANVAS_HEIGHT * 0.2, CANVAS_WIDTH * 0.1 - 10, CANVAS_HEIGHT * 0.35);
    ctx.lineTo(CANVAS_WIDTH * 0.1 - 30, CANVAS_HEIGHT * 0.35);
    ctx.closePath();
    ctx.fill();
    // Right curtain
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH * 0.1 + 160, CANVAS_HEIGHT * 0.08);
    ctx.quadraticCurveTo(CANVAS_WIDTH * 0.1 + 120, CANVAS_HEIGHT * 0.2, CANVAS_WIDTH * 0.1 + 150, CANVAS_HEIGHT * 0.35);
    ctx.lineTo(CANVAS_WIDTH * 0.1 + 170, CANVAS_HEIGHT * 0.35);
    ctx.closePath();
    ctx.fill();

    // Picture Frame (Enlarged)
    const picX = CANVAS_WIDTH * 0.35;
    const picY = CANVAS_HEIGHT * 0.12;
    const picW = 120;
    const picH = 90;
    
    ctx.fillStyle = '#5D2E0C'; // Frame color
    ctx.fillRect(picX, picY, picW, picH);
    
    // Canvas background (Sky)
    ctx.fillStyle = '#AEE2FF';
    ctx.fillRect(picX + 5, picY + 5, picW - 10, picH - 10);
    
    // Sea
    ctx.fillStyle = '#007AFF';
    ctx.fillRect(picX + 5, picY + picH * 0.6, picW - 10, picH * 0.4 - 5);
    
    // Sailboat
    const boatX = picX + picW * 0.5;
    const boatY = picY + picH * 0.65;
    
    // Hull
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(boatX - 15, boatY);
    ctx.lineTo(boatX + 15, boatY);
    ctx.lineTo(boatX + 10, boatY + 8);
    ctx.lineTo(boatX - 10, boatY + 8);
    ctx.closePath();
    ctx.fill();
    
    // Mast
    ctx.strokeStyle = '#3A2618';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(boatX, boatY);
    ctx.lineTo(boatX, boatY - 20);
    ctx.stroke();
    
    // Sails (Both sides)
    ctx.fillStyle = '#FF3B30';
    // Right Sail
    ctx.beginPath();
    ctx.moveTo(boatX + 2, boatY - 2);
    ctx.lineTo(boatX + 12, boatY - 2);
    ctx.lineTo(boatX + 2, boatY - 18);
    ctx.closePath();
    ctx.fill();
    // Left Sail
    ctx.beginPath();
    ctx.moveTo(boatX - 2, boatY - 2);
    ctx.lineTo(boatX - 12, boatY - 2);
    ctx.lineTo(boatX - 2, boatY - 18);
    ctx.closePath();
    ctx.fill();

    // Couch (Detailed)
    // Shadow under couch
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(CANVAS_WIDTH * 0.6, CANVAS_HEIGHT * 0.7, 160, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#AF52DE'; // Purple couch
    // Backrest
    ctx.beginPath();
    const brX = CANVAS_WIDTH * 0.45;
    const brY = CANVAS_HEIGHT * 0.45;
    const brW = 280;
    const brH = 140;
    const brR = 30;
    ctx.moveTo(brX + brR, brY);
    ctx.arcTo(brX + brW, brY, brX + brW, brY + brH, brR);
    ctx.arcTo(brX + brW, brY + brH, brX, brY + brH, brR);
    ctx.arcTo(brX, brY + brH, brX, brY, brR);
    ctx.arcTo(brX, brY, brX + brW, brY, brR);
    ctx.closePath();
    ctx.fill();

    // Cushions
    ctx.fillStyle = '#BF5AF2';
    // Cushion 1
    ctx.beginPath();
    const c1X = CANVAS_WIDTH * 0.43;
    const c1Y = CANVAS_HEIGHT * 0.58;
    const c1W = 155;
    const c1H = 70;
    const c1R = 15;
    ctx.moveTo(c1X + c1R, c1Y);
    ctx.arcTo(c1X + c1W, c1Y, c1X + c1W, c1Y + c1H, c1R);
    ctx.arcTo(c1X + c1W, c1Y + c1H, c1X, c1Y + c1H, c1R);
    ctx.arcTo(c1X, c1Y + c1H, c1X, c1Y, c1R);
    ctx.arcTo(c1X, c1Y, c1X + c1W, c1Y, c1R);
    ctx.closePath();
    ctx.fill();
    // Cushion 2
    ctx.beginPath();
    const c2X = CANVAS_WIDTH * 0.58;
    const c2Y = CANVAS_HEIGHT * 0.58;
    const c2W = 155;
    const c2H = 70;
    const c2R = 15;
    ctx.moveTo(c2X + c2R, c2Y);
    ctx.arcTo(c2X + c2W, c2Y, c2X + c2W, c2Y + c2H, c2R);
    ctx.arcTo(c2X + c2W, c2Y + c2H, c2X, c2Y + c2H, c2R);
    ctx.arcTo(c2X, c2Y + c2H, c2X, c2Y, c2R);
    ctx.arcTo(c2X, c2Y, c2X + c2W, c2Y, c2R);
    ctx.closePath();
    ctx.fill();

    // Arms
    ctx.fillStyle = '#AF52DE';
    // Arm 1
    ctx.beginPath();
    const a1X = CANVAS_WIDTH * 0.4;
    const a1Y = CANVAS_HEIGHT * 0.55;
    const a1W = 50;
    const a1H = 100;
    const a1R = 20;
    ctx.moveTo(a1X + a1R, a1Y);
    ctx.arcTo(a1X + a1W, a1Y, a1X + a1W, a1Y + a1H, a1R);
    ctx.arcTo(a1X + a1W, a1Y + a1H, a1X, a1Y + a1H, a1R);
    ctx.arcTo(a1X, a1Y + a1H, a1X, a1Y, a1R);
    ctx.arcTo(a1X, a1Y, a1X + a1W, a1Y, a1R);
    ctx.closePath();
    ctx.fill();
    // Arm 2
    ctx.beginPath();
    const a2X = CANVAS_WIDTH * 0.72;
    const a2Y = CANVAS_HEIGHT * 0.55;
    const a2W = 50;
    const a2H = 100;
    const a2R = 20;
    ctx.moveTo(a2X + a2R, a2Y);
    ctx.arcTo(a2X + a2W, a2Y, a2X + a2W, a2Y + a2H, a2R);
    ctx.arcTo(a2X + a2W, a2Y + a2H, a2X, a2Y + a2H, a2R);
    ctx.arcTo(a2X, a2Y + a2H, a2X, a2Y, a2R);
    ctx.arcTo(a2X, a2Y, a2X + a2W, a2Y, a2R);
    ctx.closePath();
    ctx.fill();
    // Legs
    ctx.fillStyle = '#3A2618';
    ctx.fillRect(CANVAS_WIDTH * 0.43, CANVAS_HEIGHT * 0.68, 15, 20);
    ctx.fillRect(CANVAS_WIDTH * 0.72, CANVAS_HEIGHT * 0.68, 15, 20);

    // Rug (Detailed)
    ctx.fillStyle = '#FF9500';
    ctx.beginPath();
    ctx.ellipse(CANVAS_WIDTH * 0.3, CANVAS_HEIGHT * 0.85, 180, 50, 0, 0, Math.PI * 2);
    ctx.fill();
    // Rug Pattern
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(CANVAS_WIDTH * 0.3, CANVAS_HEIGHT * 0.85, 150, 35, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(CANVAS_WIDTH * 0.3, CANVAS_HEIGHT * 0.85, 100, 20, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Bookshelf
    ctx.fillStyle = '#8E6E53';
    ctx.fillRect(CANVAS_WIDTH * 0.75, CANVAS_HEIGHT * 0.1, 120, 250);
    ctx.fillStyle = '#5D4037';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(CANVAS_WIDTH * 0.75 + 5, CANVAS_HEIGHT * 0.1 + 10 + (i * 60), 110, 5); // Shelves
    }
    // Books
    const bookColors = ['#FF3B30', '#4CD964', '#007AFF', '#FFCC00', '#5856D6'];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 6; j++) {
        ctx.fillStyle = bookColors[(i + j) % bookColors.length];
        ctx.fillRect(CANVAS_WIDTH * 0.75 + 10 + (j * 15), CANVAS_HEIGHT * 0.1 + 15 + (i * 60), 12, 45);
      }
    }

    // Lamp (Detailed)
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(CANVAS_WIDTH * 0.08, CANVAS_HEIGHT * 0.7, 40, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1C1C1E';
    ctx.fillRect(CANVAS_WIDTH * 0.08 - 2, CANVAS_HEIGHT * 0.35, 4, 260); // Stem
    ctx.beginPath();
    ctx.ellipse(CANVAS_WIDTH * 0.08, CANVAS_HEIGHT * 0.7, 35, 8, 0, 0, Math.PI * 2); // Base
    ctx.fill();
    
    // Lamp Shade
    ctx.fillStyle = '#FFCC00';
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH * 0.08 - 40, CANVAS_HEIGHT * 0.35);
    ctx.lineTo(CANVAS_WIDTH * 0.08 + 40, CANVAS_HEIGHT * 0.35);
    ctx.lineTo(CANVAS_WIDTH * 0.08 + 60, CANVAS_HEIGHT * 0.5);
    ctx.lineTo(CANVAS_WIDTH * 0.08 - 60, CANVAS_HEIGHT * 0.5);
    ctx.closePath();
    ctx.fill();
    
    // Light Glow
    const glow = ctx.createRadialGradient(
      CANVAS_WIDTH * 0.08, CANVAS_HEIGHT * 0.5, 10,
      CANVAS_WIDTH * 0.08, CANVAS_HEIGHT * 0.6, 150
    );
    glow.addColorStop(0, 'rgba(255, 204, 0, 0.3)');
    glow.addColorStop(1, 'rgba(255, 204, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH * 0.08 - 60, CANVAS_HEIGHT * 0.5);
    ctx.lineTo(CANVAS_WIDTH * 0.08 + 60, CANVAS_HEIGHT * 0.5);
    ctx.lineTo(CANVAS_WIDTH * 0.08 + 150, CANVAS_HEIGHT * 0.8);
    ctx.lineTo(CANVAS_WIDTH * 0.08 - 150, CANVAS_HEIGHT * 0.8);
    ctx.fill();

    // Draw Hamsters
    hamstersRef.current.forEach(h => {
      const config = HAMSTER_TYPES[h.type];
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rotation);

      // Squash and Stretch
      let scaleX = 1;
      let scaleY = 1;
      
      if (h.state === 'popping') {
        const p = Math.min(1, h.timer / 500);
        scaleY = 0.5 + p * 0.5;
        scaleX = 1.2 - p * 0.2;
      } else if (h.state === 'leaving') {
        const p = Math.max(0, 1 - (h.timer / 500));
        scaleY = p;
        scaleX = p;
      } else if (h.state === 'chewing') {
        const bounce = Math.sin(h.timer * 0.02) * 0.1;
        scaleY = 1 + bounce;
        scaleX = 1 - bounce;
      }

      ctx.scale(scaleX, scaleY);

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.beginPath();
      ctx.ellipse(0, h.size * 0.8, h.size * 0.8, h.size * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body (Pillow shape)
      const w = h.size * 1.1;
      const h_body = h.size * 1.4;
      
      ctx.fillStyle = h.color;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;

      // Ears (Integrated bumps)
      ctx.beginPath();
      ctx.ellipse(-w * 0.3, -h_body * 0.45, h.size * 0.2, h.size * 0.25, -Math.PI/6, 0, Math.PI * 2);
      ctx.ellipse(w * 0.3, -h_body * 0.45, h.size * 0.2, h.size * 0.25, Math.PI/6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Main Body
      ctx.beginPath();
      const bodyX = -w/2;
      const bodyY = -h_body/2;
      const bodyW = w;
      const bodyH = h_body;
      const bodyR = h.size * 0.4;
      ctx.moveTo(bodyX + bodyR, bodyY);
      ctx.arcTo(bodyX + bodyW, bodyY, bodyX + bodyW, bodyY + bodyH, bodyR);
      ctx.arcTo(bodyX + bodyW, bodyY + bodyH, bodyX, bodyY + bodyH, bodyR);
      ctx.arcTo(bodyX, bodyY + bodyH, bodyX, bodyY, bodyR);
      ctx.arcTo(bodyX, bodyY, bodyX + bodyW, bodyY, bodyR);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Eyes (Large circles)
      ctx.fillStyle = '#000000';
      const eyeY = -h_body * 0.1;
      const eyeX = w * 0.25;
      const currentEyeSize = h.state === 'chewing' ? config.eyeSize * 1.2 : config.eyeSize;
      
      ctx.beginPath();
      ctx.arc(-eyeX, eyeY, currentEyeSize, 0, Math.PI * 2);
      ctx.arc(eyeX, eyeY, currentEyeSize, 0, Math.PI * 2);
      ctx.fill();

      // Pupils (Small white dots)
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-eyeX + currentEyeSize * 0.3, eyeY - currentEyeSize * 0.3, currentEyeSize * 0.3, 0, Math.PI * 2);
      ctx.arc(eyeX + currentEyeSize * 0.3, eyeY - currentEyeSize * 0.3, currentEyeSize * 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Nose/Mouth
      const mouthY = h_body * 0.15;
      
      if (h.state === 'chewing') {
        // Open mouth with buck teeth (Previous iteration style)
        const mouthWidth = h.size * 0.3 + Math.sin(h.timer * 0.05) * h.size * 0.03;
        const mouthHeight = h.size * 0.4 + Math.sin(h.timer * 0.05) * h.size * 0.03;

        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(0, mouthY, mouthWidth, mouthHeight, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Buck Teeth
        ctx.fillStyle = '#FFFFFF';
        const toothWidth = mouthWidth * 0.35;
        const toothHeight = mouthHeight * 0.45;
        const toothR = 2;
        
        // Top Teeth
        ctx.beginPath();
        // Left tooth
        let tX = -toothWidth - 1;
        let tY = mouthY - mouthHeight * 0.8;
        ctx.moveTo(tX + toothR, tY);
        ctx.arcTo(tX + toothWidth, tY, tX + toothWidth, tY + toothHeight, toothR);
        ctx.arcTo(tX + toothWidth, tY + toothHeight, tX, tY + toothHeight, toothR);
        ctx.arcTo(tX, tY + toothHeight, tX, tY, toothR);
        ctx.arcTo(tX, tY, tX + toothWidth, tY, toothR);
        ctx.closePath();
        // Right tooth
        tX = 1;
        ctx.moveTo(tX + toothR, tY);
        ctx.arcTo(tX + toothWidth, tY, tX + toothWidth, tY + toothHeight, toothR);
        ctx.arcTo(tX + toothWidth, tY + toothHeight, tX, tY + toothHeight, toothR);
        ctx.arcTo(tX, tY + toothHeight, tX, tY, toothR);
        ctx.arcTo(tX, tY, tX + toothWidth, tY, toothR);
        ctx.closePath();
        ctx.fill();
        
        // Bottom Teeth
        ctx.beginPath();
        const bToothHeight = toothHeight * 0.7;
        // Left tooth
        tX = -toothWidth - 1;
        tY = mouthY + mouthHeight * 0.1;
        ctx.moveTo(tX + toothR, tY);
        ctx.arcTo(tX + toothWidth, tY, tX + toothWidth, tY + bToothHeight, toothR);
        ctx.arcTo(tX + toothWidth, tY + bToothHeight, tX, tY + bToothHeight, toothR);
        ctx.arcTo(tX, tY + bToothHeight, tX, tY, toothR);
        ctx.arcTo(tX, tY, tX + toothWidth, tY, toothR);
        ctx.closePath();
        // Right tooth
        tX = 1;
        ctx.moveTo(tX + toothR, tY);
        ctx.arcTo(tX + toothWidth, tY, tX + toothWidth, tY + bToothHeight, toothR);
        ctx.arcTo(tX + toothWidth, tY + bToothHeight, tX, tY + bToothHeight, toothR);
        ctx.arcTo(tX, tY + bToothHeight, tX, tY, toothR);
        ctx.arcTo(tX, tY, tX + toothWidth, tY, toothR);
        ctx.closePath();
        ctx.fill();
      } else {
        // Simple Y shape nose/mouth
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, mouthY);
        ctx.lineTo(0, mouthY + 8);
        ctx.moveTo(0, mouthY);
        ctx.lineTo(-6, mouthY - 4);
        ctx.moveTo(0, mouthY);
        ctx.lineTo(6, mouthY - 4);
        ctx.stroke();
      }

      // Cheeks (if chewing)
      if (h.state === 'chewing') {
        ctx.fillStyle = '#FF2D55';
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(-h.size * 0.6, h.size * 0.2, h.size * 0.25, 0, Math.PI * 2);
        ctx.arc(h.size * 0.6, h.size * 0.2, h.size * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }
        
  // Vibration effect
  // h.rotation += (Math.random() - 0.5) * 0.1; // MOVED TO updateGame
  
  ctx.restore();
});

    // Draw Broom (Cursor)
    if (gameStateRef.current === 'playing') {
      const { x, y } = mousePosRef.current;
      const now = performance.now();
      const timeSinceClick = now - lastClickTimeRef.current;
      const isSwishing = timeSinceClick < 200;
      
      ctx.save();
      ctx.translate(x, y);
      
      // Swish animation: rotate and move slightly
      let rotation = -Math.PI / 4;
      let offsetX = 0;
      if (isSwishing) {
        const p = timeSinceClick / 200;
        rotation -= Math.sin(p * Math.PI) * 0.5;
        offsetX -= Math.sin(p * Math.PI) * 20;
      }
      
      ctx.rotate(rotation);
      ctx.translate(offsetX, 0);

      // Handle
      ctx.fillStyle = '#8E6E53';
      ctx.fillRect(-2, -60, 4, 60);

      // Bristles
      ctx.fillStyle = '#FFCC00';
      ctx.beginPath();
      ctx.moveTo(-15, 0);
      ctx.lineTo(15, 0);
      ctx.lineTo(20, 25);
      ctx.lineTo(-20, 25);
      ctx.closePath();
      ctx.fill();

      // Bristle lines
      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = 1;
      for (let i = -15; i <= 15; i += 5) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i * 1.2, 25);
        ctx.stroke();
      }

      // Band
      ctx.fillStyle = '#5D4037';
      ctx.fillRect(-16, 0, 32, 5);

      // Draw Hit Radius (Debug/Visual feedback)
      if (isSwishing) {
        ctx.restore();
        ctx.save();
        ctx.translate(x, y);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(0, 0, BROOM_HIT_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }
  }, []);

  const updateGame = useCallback((time: number) => {
    if (gameStateRef.current !== 'playing') return;

    // Delta time calculation
    const now = performance.now();
    let dt = lastFrameTimeRef.current ? now - lastFrameTimeRef.current : 16;
    // Cap dt to prevent huge jumps (e.g. tab switching)
    if (dt > 100) dt = 16;
    lastFrameTimeRef.current = now;

    // Spawning
    const currentScore = scoreRef.current;
    if (now - lastSpawnRef.current > HAMSTER_SPAWN_RATE - Math.min(currentScore * 2, 1000)) {
      spawnHamster();
      lastSpawnRef.current = now;
    }

    // Update Hamsters
    const nextHamsters: Hamster[] = [];
    let damageDelta = 0;

    hamstersRef.current.forEach(h => {
      h.timer += dt;
      let shouldKeep = true;

      // Vibration effect (moved from draw)
      h.rotation += (Math.random() - 0.5) * 0.1;

      if (h.state === 'popping') {
        if (h.timer > 500) {
          h.state = 'active';
          h.timer = 0;
        }
      } else if (h.state === 'active') {
        if (h.timer > 2000) {
          h.state = 'chewing';
          h.timer = 0;
        }
      } else if (h.state === 'chewing') {
        h.chewTimer += dt;
        if (h.chewTimer > 100) {
          damageDelta += HAMSTER_TYPES[h.type].damage;
          h.chewTimer = 0;
        }
        if (h.timer > 3000) {
          h.state = 'leaving';
          h.timer = 0;
        }
      } else if (h.state === 'leaving') {
        if (h.timer > 500) shouldKeep = false;
      }

      if (shouldKeep) nextHamsters.push(h);
    });

    hamstersRef.current = nextHamsters;
    
    if (damageDelta > 0) {
      playChewSound();
      setDamage(prev => {
        const next = prev + damageDelta;
        if (next >= MAX_DAMAGE) {
          playGameOverSound();
          setGameState('gameover');
          return MAX_DAMAGE;
        }
        return next;
      });
    }

    // Draw
    draw();
  }, [spawnHamster, draw, playChewSound, playGameOverSound]);

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = (clientX - rect.left) * (CANVAS_WIDTH / rect.width);
    const y = (clientY - rect.top) * (CANVAS_HEIGHT / rect.height);

    lastClickTimeRef.current = performance.now();

    // Check hits (reverse order to hit top ones)
    for (let i = hamstersRef.current.length - 1; i >= 0; i--) {
      const h = hamstersRef.current[i];
      const dist = Math.sqrt((x - h.x) ** 2 + (y - h.y) ** 2);
      
      // Use BROOM_HIT_RADIUS instead of h.size for easier sweeping
      if (dist < BROOM_HIT_RADIUS) {
        // Hit!
        playHitSound();
        setScore(prev => prev + HAMSTER_TYPES[h.type].points);
        h.state = 'leaving';
        h.timer = 0;
        // Don't break here to allow sweeping multiple hamsters at once!
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = (clientX - rect.left) * (CANVAS_WIDTH / rect.width);
    const y = (clientY - rect.top) * (CANVAS_HEIGHT / rect.height);
    mousePosRef.current = { x, y };
  };

  const startGame = () => {
    initAudio();
    setScore(0);
    setDamage(0);
    hamstersRef.current = [];
    lastSpawnRef.current = performance.now();
    lastFrameTimeRef.current = performance.now();
    spawnHamster();
    setGameState('playing');
  };

  const resetGame = () => {
    setGameState('start');
  };

  // Main loop lifecycle
  useEffect(() => {
    if (gameState !== 'playing') return;

    let requestId: number;
    
    const loop = (time: number) => {
      updateGame(time);
      requestId = requestAnimationFrame(loop);
    };

    requestId = requestAnimationFrame(loop);
    
    return () => {
      if (requestId) cancelAnimationFrame(requestId);
    };
  }, [gameState, updateGame]);

  // --- Render ---

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col items-center justify-center p-4 font-sans overflow-hidden select-none">
      {/* Game Container */}
      <div 
        className="relative bg-white rounded-[3rem] shadow-[0_30px_60px_rgba(0,0,0,0.4)] border-8 border-black overflow-hidden w-full max-w-[800px] aspect-[800/600]"
      >
        
        {/* HUD */}
        <AnimatePresence>
          {gameState === 'playing' && (
            <motion.div 
              initial={{ y: -100 }}
              animate={{ y: 0 }}
              exit={{ y: -100 }}
              className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-30 pointer-events-none"
            >
              <div className="flex flex-col gap-2">
                <div className="bg-white px-6 py-2 rounded-full shadow-xl border-4 border-black flex items-center gap-3">
                  <Trophy className="w-6 h-6 text-[#FF3B30]" />
                  <span className="text-2xl font-black text-black tabular-nums">{score}</span>
                </div>
                <div className="bg-white px-4 py-1 rounded-full shadow-md border-2 border-black flex items-center gap-2">
                  <span className="text-[10px] font-black text-[#007AFF] uppercase tracking-wider">Best</span>
                  <span className="text-sm font-black text-black">{highScore}</span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="w-48 h-8 bg-white rounded-full shadow-xl border-4 border-black overflow-hidden p-1">
                  <motion.div 
                    className="h-full rounded-full bg-gradient-to-r from-[#FF3B30] to-[#FF2D55]"
                    initial={{ width: '0%' }}
                    animate={{ width: `${(damage / MAX_DAMAGE) * 100}%` }}
                    transition={{ type: 'spring', stiffness: 50 }}
                  />
                </div>
                <span className="text-[10px] font-black text-black uppercase tracking-widest text-right">Room Damage</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Canvas */}
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          onTouchStart={handleCanvasClick}
          onTouchMove={handleCanvasMouseMove}
          className="block cursor-none w-full h-full touch-none"
          style={{ touchAction: 'none' }}
        />

        {/* Screens */}
        <AnimatePresence>
          {gameState === 'start' && (
            <motion.div
              key="start"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.2 }}
              className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-white/90 backdrop-blur-md p-8 text-center"
            >
              {/* Menu Hamsters */}
              <MenuHamster color="#8B4513" size={60} x="15%" y="20%" rotation={-15} delay={0.2} />
              <MenuHamster color="#B2E2F2" size={50} x="75%" y="15%" rotation={20} delay={0.4} />
              <MenuHamster color="#FFDAC1" size={70} x="10%" y="70%" rotation={10} delay={0.6} />
              <MenuHamster color="#E2F0CB" size={55} x="80%" y="75%" rotation={-10} delay={0.8} />

              <motion.div
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="mb-12 relative z-20"
              >
                <h1 className="text-8xl font-wacky drop-shadow-[0_8px_0_#000000] [-webkit-text-stroke:3px_black] tracking-tighter leading-none select-none flex flex-col">
                  <span className="text-[#FF3B30] rotate-[-2deg]">HAMSTER</span>
                  <span className="text-[#FFCC00] rotate-[2deg] -mt-2">HAVOC</span>
                </h1>
                <div className="mt-6 inline-block bg-[#007AFF] text-white px-6 py-2 rounded-full font-black text-sm uppercase tracking-[0.3em] shadow-lg">
                  The Game
                </div>
              </motion.div>

              <div className="flex flex-col gap-6 w-full max-w-xs relative z-20">
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={startGame}
                  className="bg-[#FF3B30] text-white font-wacky text-4xl py-6 rounded-[2.5rem] shadow-[0_12px_0_#000000] hover:shadow-[0_6px_0_#000000] hover:translate-y-[6px] transition-all cursor-pointer border-4 border-black"
                >
                  START!
                </motion.button>
                
                <button
                  onClick={() => setShowInfo(true)}
                  className="flex items-center justify-center gap-2 text-[#007AFF] font-black text-sm uppercase tracking-widest hover:text-[#FF3B30] transition-colors cursor-pointer"
                >
                  <Info size={18} />
                  How to Play
                </button>
              </div>
            </motion.div>
          )}

          {gameState === 'gameover' && (
            <motion.div
              key="gameover"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#FF3B30]/95 backdrop-blur-lg p-8 text-center"
            >
              {/* Sad Hamsters */}
              <MenuHamster color="#8B4513" size={60} x="20%" y="15%" rotation={0} delay={0.1} />
              <MenuHamster color="#B2E2F2" size={50} x="70%" y="20%" rotation={180} delay={0.3} />

              <motion.h2 
                animate={{ scale: [1, 1.1, 1], rotate: [-2, 2, -2] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="text-8xl font-wacky text-white drop-shadow-[0_8px_0_#000000] [-webkit-text-stroke:3px_black] mb-4 relative z-20"
              >
                OH NO!
              </motion.h2>
              <p className="text-white font-black text-2xl mb-2 uppercase tracking-[0.2em] drop-shadow-md relative z-20">The room is a mess!</p>
              <p className="text-white/70 font-black text-xs mb-10 uppercase tracking-[0.3em] relative z-20 italic">you suck...</p>
              
              <div className="bg-white rounded-[3rem] p-10 shadow-2xl mb-10 w-full max-w-xs border-8 border-black relative z-20">
                <div className="mb-4">
                  <p className="text-[#007AFF] font-black text-xs uppercase tracking-widest mb-2">Final Score</p>
                  <p className="text-7xl font-wacky text-black tabular-nums [-webkit-text-stroke:2px_black]">{score}</p>
                </div>
                {score >= highScore && score > 0 && (
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="bg-[#FFCC00] text-black font-black text-sm py-2 px-6 rounded-full inline-block border-2 border-black shadow-md"
                  >
                    NEW HIGH SCORE!
                  </motion.div>
                )}
              </div>

              <div className="flex flex-col gap-4 w-full max-w-xs relative z-20">
                <motion.button
                  whileHover={{ scale: 1.1, rotate: -2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={startGame}
                  className="bg-white text-[#FF3B30] font-wacky text-3xl py-5 rounded-[2.5rem] shadow-[0_10px_0_#000000] hover:shadow-[0_5px_0_#000000] hover:translate-y-[5px] transition-all cursor-pointer border-4 border-black"
                >
                  TRY AGAIN
                </motion.button>
                <button
                  onClick={() => setGameState('start')}
                  className="text-white font-black text-sm uppercase tracking-widest hover:text-[#FFCC00] transition-colors cursor-pointer"
                >
                  Back to Menu
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Debug Info */}
        <div className="absolute bottom-4 left-6 text-[10px] font-black text-[#FFB7B2]/30 pointer-events-none z-50 uppercase tracking-widest">
          H: {hamstersRef.current.length} | {gameState}
        </div>
      </div>

      {/* Footer Legend */}
      <div className="mt-10 flex flex-wrap justify-center gap-8 text-[#FFB7B2] font-black text-xs uppercase tracking-[0.2em]">
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full shadow-sm border border-[#FFDAC1]">
          <div className="w-4 h-4 rounded-full bg-[#FFB7B2]" />
          <span>Normal</span>
        </div>
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full shadow-sm border border-[#FFDAC1]">
          <div className="w-4 h-4 rounded-full bg-[#B2E2F2]" />
          <span>Fast</span>
        </div>
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full shadow-sm border border-[#FFDAC1]">
          <div className="w-4 h-4 rounded-full bg-[#FFDAC1]" />
          <span>Heavy</span>
        </div>
      </div>

      {/* Info Modal */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D3436]/40 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              className="bg-white rounded-[4rem] p-12 max-w-md w-full shadow-2xl border-[12px] border-[#B2E2F2] relative"
            >
              <button 
                onClick={() => setShowInfo(false)}
                className="absolute top-6 right-6 text-[#B2E2F2] hover:text-[#FFB7B2] transition-colors cursor-pointer"
              >
                <X size={32} />
              </button>

              <h3 className="text-5xl font-black text-[#2D3436] mb-8 tracking-tighter [-webkit-text-stroke:1.5px_#2D3436]">How to Play</h3>
              <ul className="space-y-6 text-[#636E72] font-bold text-xl">
                <li className="flex gap-5">
                  <div className="flex-shrink-0 w-10 h-10 bg-[#FFB7B2] text-white rounded-2xl flex items-center justify-center font-black shadow-md">1</div>
                  <p className="leading-tight">Mischievous hamsters are popping up in your room!</p>
                </li>
                <li className="flex gap-5">
                  <div className="flex-shrink-0 w-10 h-10 bg-[#B2E2F2] text-white rounded-2xl flex items-center justify-center font-black shadow-md">2</div>
                  <p className="leading-tight">Click them quickly before they start chewing the furniture.</p>
                </li>
                <li className="flex gap-5">
                  <div className="flex-shrink-0 w-10 h-10 bg-[#FFDAC1] text-white rounded-2xl flex items-center justify-center font-black shadow-md">3</div>
                  <p className="leading-tight">If the room damage reaches 100%, it's game over!</p>
                </li>
              </ul>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowInfo(false)}
                className="mt-12 w-full bg-[#B2E2F2] text-white font-black text-2xl py-5 rounded-[2.5rem] shadow-[0_10px_0_#81D4EE] hover:shadow-[0_5px_0_#81D4EE] hover:translate-y-[5px] transition-all cursor-pointer"
              >
                GOT IT!
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

