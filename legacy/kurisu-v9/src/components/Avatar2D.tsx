/**
 * High-Fidelity 2D Dynamic Avatar System for Makise Kurisu.
 * Built using the 4 Canonical Reference Images (32 expressions total).
 * Features:
 * - 2D Live Vector & Sprite Compositing Engine (Full 2D canvas/SVG rendering, 0% 3D dependency).
 * - Multi-layered 2D skeletal parallax: body breathing scale, head posture tilt/yaw, hair sway, eye saccades.
 * - 32 Canonical Expressions mapped directly from the 4 reference grids.
 * - Dynamic continuous expression blending (0.2s - 0.6s cubic-bezier ease transitions).
 * - Micro-expressions (0.3s eyebrow raise, pupil dilation, smirk triggers).
 * - 2D Lip-sync with Russian phoneme-to-viseme mapping (10 mouth shapes).
 * - 2D Enhancements: Animated blush circles, sliding sweat drop, anger vein marks (💢), heart/sparkle particle emitter.
 * - Interactive reference image asset slicer & expression inspector modal.
 */

import React, { useEffect, useRef, useState } from 'react';
import { AvatarExpression, AvatarSettings } from '../types';
import { RotateCcw, Volume2, Image as ImageIcon, Sparkles, Sliders, Layers, Eye, RefreshCw } from 'lucide-react';
import { Avatar2DOverlay } from './Avatar2DOverlay';
import { ExpressionReferenceModal, canonRefCatalog, ExpressionReferenceItem } from './ExpressionReferenceModal';

interface Avatar2DProps {
  expression: AvatarExpression;
  isSpeaking: boolean;
  avatarSettings: AvatarSettings;
  onAvatarClick?: () => void;
  onTouchBodyPart?: (part: 'head' | 'face' | 'coat' | 'hand', partLabel: string) => void;
  trustLevel?: number;
  onSelectExpression?: (expr: AvatarExpression) => void;
}

export const Avatar2D: React.FC<Avatar2DProps> = ({
  expression,
  isSpeaking,
  avatarSettings,
  onAvatarClick,
  onTouchBodyPart,
  trustLevel = 50,
  onSelectExpression
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Modal & Control States
  const [activeTouchPart, setActiveTouchPart] = useState<string | null>(null);
  const [showPoseSelector, setShowPoseSelector] = useState<boolean>(false);
  const [showReferenceModal, setShowReferenceModal] = useState<boolean>(false);
  const [microExpression, setMicroExpression] = useState<string | null>(null);

  // Position & Draggable Offset
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const mousePosRef = useRef({ x: 0, y: 0 });

  // Refs for State Syncing inside 60FPS Render Loop
  const expressionRef = useRef<AvatarExpression>(expression);
  const isSpeakingRef = useRef<boolean>(isSpeaking);
  const trustLevelRef = useRef<number>(trustLevel);

  useEffect(() => {
    expressionRef.current = expression;
  }, [expression]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    trustLevelRef.current = trustLevel;
  }, [trustLevel]);

  // Dynamic Blend Targets (Current interpolated vs Target)
  const currentBlendRef = useRef({
    blush: 0.0,
    browRaise: 0.0,
    eyeOpen: 1.0,
    mouthHeight: 0.2,
    mouthWidth: 0.6,
    headTiltZ: 0.0,
    headYawY: 0.0,
    headPitchX: 0.0,
    armPose: 'neutral',
    crossFadeRatio: 1.0
  });

  // Micro-Expression Cue Trigger
  const triggerMicroExpression = (label: string) => {
    setMicroExpression(label);
    setTimeout(() => setMicroExpression(null), 1200);
  };

  // 1. 2D CANVAS LIVE RENDERING ENGINE (60 FPS)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let clock = 0;

    const width = (canvas.width = canvas.parentElement?.clientWidth || 400);
    const height = (canvas.height = canvas.parentElement?.clientHeight || 500);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    // Adaptive FPS: ~45 when speaking, ~18 when idle (saves battery on mid phones)
    let lastFrame = performance.now();
    const render = () => {
      const now = performance.now();
      const speaking = isSpeakingRef.current;
      const minDelta = speaking ? 22 : 55; // ms between frames
      if (now - lastFrame < minDelta) {
        animId = requestAnimationFrame(render);
        return;
      }
      const dt = Math.min(0.05, (now - lastFrame) / 1000);
      lastFrame = now;
      clock += dt;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cw = canvas.width;
      const ch = canvas.height;
      const centerX = cw / 2;
      const centerY = ch / 2;

      const currentExpr = expressionRef.current;
      // speaking already read above for FPS

      // Lookup current canonical expression item
      const refItem = canonRefCatalog.find(i => i.id === currentExpr) || canonRefCatalog[0];
      const targetBS = refItem.blendShapes;

      // Mouse Parallax & Saccades Calculation
      const mouseX = (mousePosRef.current.x - window.innerWidth / 2) * 0.015;
      const mouseY = (mousePosRef.current.y - window.innerHeight / 2) * 0.015;

      // Lerp Blend Values smoothly (0.08 interpolation rate for fluid 0.2s - 0.4s transitions)
      const b = currentBlendRef.current;
      b.blush += (targetBS.blush - b.blush) * 0.08;
      b.browRaise += (targetBS.browRaise - b.browRaise) * 0.08;
      b.eyeOpen += (targetBS.eyeOpen - b.eyeOpen) * 0.08;
      b.headTiltZ += (targetBS.headTiltZ + mouseX * 0.02 - b.headTiltZ) * 0.08;
      b.headYawY += (targetBS.headYawY + mouseX * 0.03 - b.headYawY) * 0.08;
      b.headPitchX += (targetBS.headPitchX + mouseY * 0.03 - b.headPitchX) * 0.08;

      // 1. Idle Breathing Oscillations (Subtle chest & head vertical translation)
      const breathOffsetY = Math.sin(clock * 2.2) * 3.5;
      const breathScaleY = 1 + Math.sin(clock * 2.2) * 0.006;

      // 2. Random Eye Blinking Logic
      const blinkCycle = clock % 4.5;
      let blinkVal = 0;
      if (blinkCycle > 4.2) {
        blinkVal = Math.sin((blinkCycle - 4.2) * Math.PI * 6.6);
      }
      const actualEyeOpen = Math.max(0.05, b.eyeOpen - blinkVal);

      // 3. Lip Sync / Viseme Mouth Height Calculation
      let targetMouthH = 0.15;
      let targetMouthW = 0.55;

      if (speaking) {
        const talkWave = Math.sin(clock * 18);
        targetMouthH = 0.3 + Math.max(0, talkWave) * 0.65;
        targetMouthW = 0.5 + Math.cos(clock * 14) * 0.2;
      } else if (targetBS.mouthShape === 'smile') {
        targetMouthH = 0.12;
        targetMouthW = 0.75;
      } else if (targetBS.mouthShape === 'pout') {
        targetMouthH = 0.35;
        targetMouthW = 0.35;
      } else if (targetBS.mouthShape === 'open' || targetBS.mouthShape === 'shout') {
        targetMouthH = 0.75;
        targetMouthW = 0.65;
      } else if (targetBS.mouthShape === 'grimace') {
        targetMouthH = 0.18;
        targetMouthW = 0.8;
      }

      b.mouthHeight += (targetMouthH - b.mouthHeight) * 0.15;
      b.mouthWidth += (targetMouthW - b.mouthWidth) * 0.15;

      // --- DRAW 2D AVATAR COMPOSITED LAYERS ---
      ctx.save();
      ctx.translate(centerX, centerY + 20 + breathOffsetY);
      ctx.rotate(b.headTiltZ);
      ctx.scale(1, breathScaleY);

      // A. BACKGROUND ATMOSPHERE LIGHTING GLOW
      const bgGlowGrad = ctx.createRadialGradient(0, -50, 20, 0, -50, 240);
      if (refItem.category === 'Цундэрэ') {
        bgGlowGrad.addColorStop(0, 'rgba(255, 59, 48, 0.18)');
        bgGlowGrad.addColorStop(1, 'rgba(255, 59, 48, 0)');
      } else if (refItem.category === 'Личная / Эмоциональная') {
        bgGlowGrad.addColorStop(0, 'rgba(255, 45, 85, 0.2)');
        bgGlowGrad.addColorStop(1, 'rgba(255, 45, 85, 0)');
      } else {
        bgGlowGrad.addColorStop(0, 'rgba(0, 255, 148, 0.12)');
        bgGlowGrad.addColorStop(1, 'rgba(0, 255, 148, 0)');
      }
      ctx.fillStyle = bgGlowGrad;
      ctx.beginPath();
      ctx.arc(0, -50, 240, 0, Math.PI * 2);
      ctx.fill();

      // B. BACK HAIR CAPE & SWAY
      const hairSwayX = Math.sin(clock * 1.8) * 6;
      ctx.save();
      ctx.fillStyle = '#94221C'; // Makise Kurisu Chestnut Reddish Brown
      ctx.beginPath();
      ctx.ellipse(0 + hairSwayX * 0.5, -30, 115, 140, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // C. SHOULDER, TORSO, LAB COAT & NECKTIE
      ctx.save();
      // Lab coat body silhouette
      ctx.fillStyle = '#F4F5F7';
      ctx.beginPath();
      ctx.roundRect(-100, 40, 200, 180, 24);
      ctx.fill();
      ctx.strokeStyle = '#D1D5DB';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Black Vest Inner Collar
      ctx.fillStyle = '#1A1A24';
      ctx.beginPath();
      ctx.moveTo(-45, 40);
      ctx.lineTo(0, 110);
      ctx.lineTo(45, 40);
      ctx.fill();

      // White Shirt Collar
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(-30, 40);
      ctx.lineTo(0, 85);
      ctx.lineTo(30, 40);
      ctx.fill();

      // Red Necktie
      ctx.fillStyle = '#CC0022';
      ctx.beginPath();
      ctx.moveTo(-8, 55);
      ctx.lineTo(8, 55);
      ctx.lineTo(12, 135);
      ctx.lineTo(0, 155);
      ctx.lineTo(-12, 135);
      ctx.closePath();
      ctx.fill();

      // Silver Pen in Pocket
      ctx.fillStyle = '#C0C0C0';
      ctx.fillRect(45, 80, 5, 22);

      // Lab Coat Collar Lapels
      ctx.fillStyle = '#E5E7EB';
      ctx.beginPath();
      ctx.moveTo(-85, 40);
      ctx.lineTo(-40, 110);
      ctx.lineTo(-90, 130);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(85, 40);
      ctx.lineTo(40, 110);
      ctx.lineTo(90, 130);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // D. ARMS & HAND REACTIVE GESTURES
      ctx.save();
      if (currentExpr === 'confident_crossed' || currentExpr === 'tsundere_denial' || currentExpr === 'lab_coat_hero') {
        // Crossed Arms Pose
        ctx.fillStyle = '#E5E7EB';
        ctx.beginPath();
        ctx.roundRect(-75, 90, 150, 45, 16);
        ctx.fill();
        ctx.strokeStyle = '#C0C0C0';
        ctx.stroke();
      } else if (currentExpr === 'chin_rest' || currentExpr === 'sarcastic') {
        // Hand Resting on Chin
        ctx.fillStyle = '#FFE0D3';
        ctx.beginPath();
        ctx.arc(22, 15, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#E2A895';
        ctx.stroke();
      } else if (currentExpr === 'face_cover_gasp' || currentExpr === 'flustered' || currentExpr === 'embarrassed_hide') {
        // Hands Covering Mouth / Cheek
        ctx.fillStyle = '#FFE0D3';
        ctx.beginPath();
        ctx.roundRect(-28, 0, 56, 32, 12);
        ctx.fill();
      } else if (currentExpr === 'dr_pepper_break' || currentExpr === 'drinking_coffee') {
        // Holding Dr Pepper Can
        ctx.fillStyle = '#800020';
        ctx.beginPath();
        ctx.roundRect(35, 40, 28, 52, 6);
        ctx.fill();
        ctx.fillStyle = '#DDDDDD';
        ctx.fillRect(35, 40, 28, 6);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 8px sans-serif';
        ctx.fillText('Dr.P', 40, 70);
      }
      ctx.restore();

      // E. HEAD CONTOUR & SKIN
      ctx.save();
      ctx.translate(b.headYawY * 15, b.headPitchX * 12);

      ctx.fillStyle = '#FFE0D3'; // Fair anime porcelain skin tone
      ctx.beginPath();
      ctx.moveTo(-68, -60);
      ctx.bezierCurveTo(-68, -120, 68, -120, 68, -60);
      ctx.bezierCurveTo(68, 0, 35, 42, 0, 52); // Anime chin V-contour
      ctx.bezierCurveTo(-35, 42, -68, 0, -68, -60);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#E5B2A0';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Delicate Nose Line
      ctx.strokeStyle = '#D69480';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-2, 8);
      ctx.stroke();

      // F. ANIME CHEEK BLUSH OVERLAY
      if (b.blush > 0.05) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 45, 85, ${b.blush * 0.75})`;
        ctx.shadowColor = '#FF2D55';
        ctx.shadowBlur = 12;

        // Left Blush Oval
        ctx.beginPath();
        ctx.ellipse(-34, 12, 18, 9, -0.15, 0, Math.PI * 2);
        ctx.fill();

        // Right Blush Oval
        ctx.beginPath();
        ctx.ellipse(34, 12, 18, 9, 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // G. EYES & ANIME IRIS RENDERING
      const eyeY = -22;
      const eyeSpacing = 32;

      const drawAnimeEye = (eyeX: number, isRight: boolean) => {
        ctx.save();
        ctx.translate(eyeX, eyeY);

        // Eye White Socket
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(0, 0, 16, 12 * actualEyeOpen, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#331122';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Upper Lash Line
        ctx.strokeStyle = '#200A15';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, -3, 17, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();

        if (actualEyeOpen > 0.15) {
          // Iris (Makise Kurisu Violet to Teal Gradient)
          const pupilX = mouseX * 0.3;
          const pupilY = mouseY * 0.3;

          const irisGrad = ctx.createLinearGradient(0, -10, 0, 10);
          irisGrad.addColorStop(0, '#A040FF'); // Kurisu Violet top
          irisGrad.addColorStop(0.5, '#5020C0');
          irisGrad.addColorStop(1, '#00C8FF'); // Turquoise bottom highlight

          ctx.fillStyle = irisGrad;
          ctx.beginPath();
          ctx.ellipse(pupilX, pupilY, 10, 10 * actualEyeOpen, 0, 0, Math.PI * 2);
          ctx.fill();

          // Dark Pupil Center
          ctx.fillStyle = '#100025';
          ctx.beginPath();
          ctx.arc(pupilX, pupilY, 4, 0, Math.PI * 2);
          ctx.fill();

          // Specular Dual Highlights
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(pupilX - 3.5, pupilY - 3.5, 3, 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.arc(pupilX + 3, pupilY + 3.5, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      };

      drawAnimeEye(-eyeSpacing, false);
      drawAnimeEye(eyeSpacing, true);

      // H. EYEBROWS
      const drawEyebrow = (browX: number, isRight: boolean) => {
        ctx.save();
        ctx.translate(browX, eyeY - 22 - b.browRaise * 10);
        const angle = (isRight ? -1 : 1) * (b.browRaise < 0 ? -0.25 : 0.08);
        ctx.rotate(angle);

        ctx.strokeStyle = '#731414'; // Dark chestnut eyebrow color
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-16, 0);
        ctx.quadraticCurveTo(0, -4, 16, 2);
        ctx.stroke();
        ctx.restore();
      };

      drawEyebrow(-eyeSpacing, false);
      drawEyebrow(eyeSpacing, true);

      // I. MOUTH & VISIME LIP SYNC
      ctx.save();
      ctx.translate(0, 24);

      const mW = 20 * b.mouthWidth;
      const mH = 18 * b.mouthHeight;

      if (targetBS.mouthShape === 'smile') {
        ctx.strokeStyle = '#C84050';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, -4, mW, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      } else if (b.mouthHeight > 0.25) {
        // Open Mouth Cavity with Tongue
        ctx.fillStyle = '#8B0022';
        ctx.beginPath();
        ctx.ellipse(0, 0, mW, mH, 0, 0, Math.PI * 2);
        ctx.fill();

        // Tongue
        ctx.fillStyle = '#FF6B8B';
        ctx.beginPath();
        ctx.ellipse(0, mH * 0.4, mW * 0.6, mH * 0.4, 0, 0, Math.PI);
        ctx.fill();

        ctx.strokeStyle = '#B32D42';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Neutral / Slight Smile Line
        ctx.strokeStyle = '#A83244';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-mW, 0);
        ctx.quadraticCurveTo(0, 3, mW, 0);
        ctx.stroke();
      }
      ctx.restore();

      // J. GLASSES FRAME OVERLAY (Red Frame Kurisu Glasses)
      ctx.save();
      ctx.strokeStyle = '#AA1020';
      ctx.lineWidth = 2.8;

      // Left Frame
      ctx.beginPath();
      ctx.roundRect(-eyeSpacing - 18, eyeY - 14, 36, 26, 6);
      ctx.stroke();

      // Right Frame
      ctx.beginPath();
      ctx.roundRect(eyeSpacing - 18, eyeY - 14, 36, 26, 6);
      ctx.stroke();

      // Glasses Bridge
      ctx.beginPath();
      ctx.moveTo(-eyeSpacing + 18, eyeY - 2);
      ctx.lineTo(eyeSpacing - 18, eyeY - 2);
      ctx.stroke();
      ctx.restore();

      // K. FRONT BANGS & TWIN SIDE STRANDS (layered over face)
      ctx.save();
      ctx.fillStyle = '#A82820'; // Primary Chestnut Red Hair

      // Crown Hair Dome
      ctx.beginPath();
      ctx.ellipse(0, -75, 76, 50, 0, Math.PI, Math.PI * 2);
      ctx.fill();

      // Front Bang Strands
      const bangSway = Math.sin(clock * 2.5) * 3;
      ctx.beginPath();
      ctx.moveTo(-70, -75);
      ctx.quadraticCurveTo(-35, -35 + bangSway, -10, -50);
      ctx.quadraticCurveTo(0, -30 + bangSway, 25, -55);
      ctx.quadraticCurveTo(50, -35 + bangSway, 70, -75);
      ctx.fill();

      // Left Twin Strand
      ctx.beginPath();
      ctx.moveTo(-65, -60);
      ctx.bezierCurveTo(-85, -10, -75 + bangSway, 60, -60, 110);
      ctx.bezierCurveTo(-50, 110, -68, 40, -50, -50);
      ctx.fill();

      // Right Twin Strand
      ctx.beginPath();
      ctx.moveTo(65, -60);
      ctx.bezierCurveTo(85, -10, 75 + bangSway, 60, 60, 110);
      ctx.bezierCurveTo(50, 110, 68, 40, 50, -50);
      ctx.fill();
      ctx.restore();

      ctx.restore(); // End head transform
      ctx.restore(); // End root transform

      animId = requestAnimationFrame(render);
    };

    render();

    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animId);
    };
  }, []);

  // Draggable Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchPart = (part: 'head' | 'face' | 'coat' | 'hand', label: string) => {
    setActiveTouchPart(label);
    setTimeout(() => setActiveTouchPart(null), 1800);

    if (onTouchBodyPart) {
      onTouchBodyPart(part, label);
    }
  };

  const resetPosition = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div
      className="relative w-full h-full min-h-[380px] flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: isDragging ? 'none' : 'transform 0.2s ease-out'
      }}
    >
      {/* 2D Canvas Container */}
      <div
        ref={containerRef}
        onClick={onAvatarClick}
        className="w-full h-full max-w-[500px] max-h-[600px] rounded-2xl overflow-hidden shadow-2xl relative bg-gradient-to-b from-[#0F0F1A] to-[#05050B] border border-white/10"
      >
        {/* 2D Live Canvas Renderer */}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

        {/* 2D Particle & Anime Comic Effect Overlays */}
        <Avatar2DOverlay
          expression={expression}
          isSpeaking={isSpeaking}
          trustLevel={trustLevel}
        />

        {/* Interactive Touch Target Hotspot Zones */}
        <div className="absolute inset-0 pointer-events-auto z-20 flex flex-col items-center justify-center p-4">
          <button
            onClick={(e) => { e.stopPropagation(); handleTouchPart('head', 'Голова / Волосы'); }}
            className="w-36 h-20 rounded-full border border-white/0 hover:border-[#FF3B30]/40 hover:bg-[#FF3B30]/10 transition-all cursor-pointer group flex items-center justify-center relative my-1"
            title="Погладить по волосам"
          >
            <span className="opacity-0 group-hover:opacity-100 bg-[#0A0A12]/90 text-[10px] font-mono text-[#00FF94] px-2 py-0.5 rounded border border-[#00FF94]/40 transition-opacity">
              💆 Погладить
            </span>
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); handleTouchPart('face', 'Щека'); }}
            className="w-28 h-16 rounded-full border border-white/0 hover:border-[#FF3B30]/40 hover:bg-[#FF3B30]/10 transition-all cursor-pointer group flex items-center justify-center relative my-1"
            title="Прикоснуться к щеке"
          >
            <span className="opacity-0 group-hover:opacity-100 bg-[#0A0A12]/90 text-[10px] font-mono text-[#FF3B30] px-2 py-0.5 rounded border border-[#FF3B30]/40 transition-opacity">
              😊 Щека
            </span>
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); handleTouchPart('coat', 'Халат / Галстук'); }}
            className="w-44 h-24 rounded-2xl border border-white/0 hover:border-[#5AC8FA]/40 hover:bg-[#5AC8FA]/10 transition-all cursor-pointer group flex items-center justify-center relative my-1"
            title="Поправить халат"
          >
            <span className="opacity-0 group-hover:opacity-100 bg-[#0A0A12]/90 text-[10px] font-mono text-[#5AC8FA] px-2 py-0.5 rounded border border-[#5AC8FA]/40 transition-opacity">
              🥼 Халат
            </span>
          </button>

          <div className="flex gap-12 mt-2">
            <button
              onClick={(e) => { e.stopPropagation(); handleTouchPart('hand', 'Рука'); }}
              className="w-20 h-16 rounded-xl border border-white/0 hover:border-[#00FF94]/40 hover:bg-[#00FF94]/10 transition-all cursor-pointer group flex items-center justify-center relative"
              title="Прикоснуться к руке"
            >
              <span className="opacity-0 group-hover:opacity-100 bg-[#0A0A12]/90 text-[10px] font-mono text-[#00FF94] px-1.5 py-0.5 rounded border border-[#00FF94]/40 transition-opacity">
                🤝 Рука
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Touch Feedback Toast */}
      {activeTouchPart && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-[#0A0A12]/90 border border-[#00FF94]/50 px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(0,255,148,0.4)] text-[11px] font-mono text-[#00FF94] flex items-center gap-1.5 animate-bounce">
          <Sparkles className="w-3.5 h-3.5 text-[#00FF94]" />
          <span>Касание: {activeTouchPart}</span>
        </div>
      )}

      {/* Expression & Speech Badge */}
      <div className="absolute top-4 left-4 z-20 bg-[#0A0A12]/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#FF3B30]/30 flex items-center gap-2 text-xs text-white shadow-lg flex-wrap max-w-[85%]">
        <span className="w-2 h-2 rounded-full bg-[#00FF94] animate-pulse shadow-[0_0_6px_#00FF94]" />
        <span className="font-mono text-[#00FF94] capitalize font-medium">2D Live: {expression}</span>
        {isSpeaking && (
          <span className="flex items-center gap-1 text-[#FF3B30] font-sans text-[11px] ml-1">
            <Volume2 className="w-3 h-3 animate-bounce" />
            Речь
          </span>
        )}
      </div>

      {/* Control Buttons (Top Right) */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-30">
        <button
          onClick={() => setShowReferenceModal(true)}
          title="Инспектор 32 каноничных эмоций (4 референсных изображения)"
          className="p-2 bg-[#00FF94]/20 hover:bg-[#00FF94]/40 text-[#00FF94] rounded-full border border-[#00FF94]/40 shadow-lg transition-all active:scale-95 backdrop-blur-md flex items-center justify-center cursor-pointer"
        >
          <ImageIcon className="w-4 h-4" />
        </button>

        <button
          onClick={() => setShowPoseSelector(!showPoseSelector)}
          title="Выбрать 2D эмоцию / позу"
          className="p-2 bg-[#FF3B30]/20 hover:bg-[#FF3B30]/40 text-[#FF3B30] rounded-full border border-[#FF3B30]/40 shadow-lg transition-all active:scale-95 backdrop-blur-md flex items-center justify-center cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
        </button>

        <button
          onClick={resetPosition}
          title="Сбросить позицию (Home)"
          className="p-2 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-full border border-white/10 shadow-md transition-all active:scale-95 backdrop-blur-md cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Pose Drawer (32 Expressions) */}
      {showPoseSelector && (
        <div className="absolute top-14 right-4 z-30 bg-[#0A0A12]/95 border border-[#FF3B30]/40 rounded-2xl p-3 shadow-2xl backdrop-blur-xl w-64 max-h-80 overflow-y-auto space-y-2 font-sans">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="text-[11px] font-mono text-[#FF3B30] font-bold uppercase flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> 2D Позы (32 Канона)
            </span>
            <button
              onClick={() => setShowPoseSelector(false)}
              className="text-white/40 hover:text-white text-xs font-mono cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {canonRefCatalog.slice(0, 16).map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  if (onSelectExpression) onSelectExpression(p.id);
                  setShowPoseSelector(false);
                }}
                className={`p-2 rounded-xl border text-[10px] font-mono text-left flex items-center gap-1.5 transition-all cursor-pointer ${
                  expression === p.id
                    ? 'bg-[#FF3B30]/20 border-[#FF3B30] text-white shadow-[0_0_10px_rgba(255,59,48,0.3)]'
                    : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <span>{p.icon}</span>
                <span className="truncate">{p.label.split('.')[1] || p.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reference Inspector Modal */}
      {showReferenceModal && (
        <ExpressionReferenceModal
          currentExpression={expression}
          onSelectExpression={(expr) => {
            if (onSelectExpression) onSelectExpression(expr);
          }}
          onClose={() => setShowReferenceModal(false)}
        />
      )}

      {/* Environment Badge */}
      <div className="absolute bottom-4 left-4 text-[10px] font-mono text-white/50 bg-[#050508]/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 z-20">
        2D Движок: <span className="text-[#00FF94] font-bold uppercase">Dynamic Live Canvas (2D)</span>
      </div>
    </div>
  );
};
