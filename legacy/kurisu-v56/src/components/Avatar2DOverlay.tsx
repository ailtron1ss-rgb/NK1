/**
 * 2D Particle & Anime Comic Effect Layer System.
 * Overlays floating particles (sparkles, hearts, sweat drops, Zzz, equations)
 * and high-impact anime reaction speed lines / vignette / rain layers over the 3D Avatar.
 */

import React, { useEffect, useRef } from 'react';
import { AvatarExpression } from '../types';

interface Avatar2DOverlayProps {
  expression: AvatarExpression;
  isSpeaking: boolean;
  trustLevel?: number;
}

export const Avatar2DOverlay: React.FC<Avatar2DOverlayProps> = ({
  expression,
  isSpeaking,
  trustLevel = 50
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Particles state
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 400);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 500);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle items
    interface Particle {
      x: number;
      y: number;
      size: number;
      vx: number;
      vy: number;
      opacity: number;
      type: 'sparkle' | 'heart' | 'sweat' | 'zzz' | 'equation' | 'rain' | 'gear';
      text?: string;
      life: number;
      maxLife: number;
    }

    const particles: Particle[] = [];

    const equations = [
      'R - ½gR = 8πT',
      'ΔS ≥ 0',
      '1.048596 %',
      'e^(iπ) + 1 = 0',
      'dτ² = (1-r_s/r)dt²',
      'PhoneWave(仮)',
      'Amadeus-OS'
    ];

    // Spawn rule based on expression
    const spawnParticle = () => {
      if (particles.length > 35) return;

      if (expression === 'happy_open_arms' || expression === 'laughing' || expression === 'smug_genius') {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height * 0.7 + height * 0.1,
          size: Math.random() * 14 + 10,
          vx: (Math.random() - 0.5) * 1.2,
          vy: -Math.random() * 1.5 - 0.5,
          opacity: 0.9,
          type: 'sparkle',
          life: 0,
          maxLife: 100
        });
      } else if (expression === 'tender_glance' || expression === 'face_cover_gasp' || trustLevel > 80) {
        if (Math.random() > 0.4) {
          particles.push({
            x: Math.random() * width * 0.6 + width * 0.2,
            y: height * 0.6 + Math.random() * 50,
            size: Math.random() * 16 + 12,
            vx: (Math.random() - 0.5) * 1.0,
            vy: -Math.random() * 1.2 - 0.8,
            opacity: 0.85,
            type: 'heart',
            life: 0,
            maxLife: 90
          });
        }
      } else if (expression === 'flustered' || expression === 'tsundere_denial' || expression === 'channel_lurker') {
        particles.push({
          x: Math.random() * width * 0.4 + width * 0.5,
          y: height * 0.2 + Math.random() * 60,
          size: Math.random() * 12 + 10,
          vx: Math.random() * 0.5 + 0.2,
          vy: Math.random() * 1.5 + 0.8,
          opacity: 0.9,
          type: 'sweat',
          life: 0,
          maxLife: 70
        });
      } else if (expression === 'sleepy' || expression === 'head_on_desk') {
        particles.push({
          x: width * 0.65 + Math.random() * 20,
          y: height * 0.35,
          size: Math.random() * 10 + 14,
          vx: Math.random() * 0.8 + 0.2,
          vy: -Math.random() * 1.0 - 0.5,
          opacity: 0.9,
          type: 'zzz',
          life: 0,
          maxLife: 120
        });
      } else if (expression === 'whiteboard_explain' || expression === 'thinking' || expression === 'steeple_hands') {
        particles.push({
          x: Math.random() * width * 0.8 + width * 0.1,
          y: height * 0.8,
          size: Math.random() * 4 + 10,
          vx: (Math.random() - 0.5) * 0.8,
          vy: -Math.random() * 0.8 - 0.4,
          opacity: 0.8,
          type: 'equation',
          text: equations[Math.floor(Math.random() * equations.length)],
          life: 0,
          maxLife: 140
        });
      } else if (expression === 'sad_rain' || expression === 'over_shoulder') {
        for (let i = 0; i < 2; i++) {
          particles.push({
            x: Math.random() * width,
            y: 0,
            size: Math.random() * 15 + 8,
            vx: -0.8,
            vy: Math.random() * 6 + 6,
            opacity: 0.6,
            type: 'rain',
            life: 0,
            maxLife: 60
          });
        }
      }
    };

    let tick = 0;
    const render = () => {
      tick++;
      ctx.clearRect(0, 0, width, height);

      if (tick % 10 === 0) {
        spawnParticle();
      }

      // Render & Update Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;

        const lifeRatio = p.life / p.maxLife;
        const currentOpacity = lifeRatio > 0.7 ? p.opacity * (1 - (lifeRatio - 0.7) / 0.3) : p.opacity;

        ctx.save();
        ctx.globalAlpha = Math.max(0, currentOpacity);

        if (p.type === 'sparkle') {
          ctx.fillStyle = '#FFE600';
          ctx.font = `${p.size}px sans-serif`;
          ctx.fillText('✨', p.x, p.y);
        } else if (p.type === 'heart') {
          ctx.fillStyle = '#FF2D55';
          ctx.font = `${p.size}px sans-serif`;
          ctx.fillText('💖', p.x, p.y);
        } else if (p.type === 'sweat') {
          ctx.fillStyle = '#5AC8FA';
          ctx.font = `${p.size}px sans-serif`;
          ctx.fillText('💧', p.x, p.y);
        } else if (p.type === 'zzz') {
          ctx.fillStyle = '#AF52DE';
          ctx.font = `bold ${p.size}px monospace`;
          ctx.fillText('Zzz...', p.x, p.y);
        } else if (p.type === 'equation' && p.text) {
          ctx.fillStyle = '#00FF94';
          ctx.shadowColor = '#00FF94';
          ctx.shadowBlur = 6;
          ctx.font = `11px monospace`;
          ctx.fillText(p.text, p.x, p.y);
        } else if (p.type === 'rain') {
          ctx.strokeStyle = 'rgba(120, 200, 255, 0.7)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - 4, p.y + p.size);
          ctx.stroke();
        }

        ctx.restore();

        if (p.life >= p.maxLife || p.y < -20 || p.y > height + 20) {
          particles.splice(i, 1);
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, [expression, trustLevel]);

  // Determine Comic Effect Overlays (Speed lines, Vignette, Sunset, Rain)
  const isHighImpact =
    expression === 'passionate_shout' ||
    expression === 'shocked' ||
    expression === 'time_travel_panic' ||
    expression === 'reach_out';

  const isSunset = expression === 'sunset_melancholy' || expression === 'dr_pepper_break';
  const isDarkSpotlight = expression === 'steeple_hands' || expression === 'dark_steeple' || expression === 'lab_lurker';

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden rounded-2xl">
      {/* 2D Particle Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Comic Speed Lines Frame (High Impact Objection/Shock) */}
      {isHighImpact && (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(255,59,48,0.25)_100%)] animate-pulse">
          <svg className="w-full h-full opacity-30 text-[#FF3B30] stroke-current" viewBox="0 0 100 100" preserveAspectRatio="none">
            {Array.from({ length: 24 }).map((_, i) => {
              const angle = (i * 360) / 24;
              const rad = (angle * Math.PI) / 180;
              const x1 = 50 + Math.cos(rad) * 20;
              const y1 = 50 + Math.sin(rad) * 20;
              const x2 = 50 + Math.cos(rad) * 70;
              const y2 = 50 + Math.sin(rad) * 70;
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="0.8" strokeDasharray="2,2" />;
            })}
          </svg>
        </div>
      )}

      {/* Sunset Radial Warm Glow Overlay */}
      {isSunset && (
        <div className="absolute inset-0 bg-gradient-to-t from-amber-600/30 via-rose-900/20 to-transparent mix-blend-screen" />
      )}

      {/* Dark Spotlight Vignette for Gendo / Secret Plan Poses */}
      {isDarkSpotlight && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(5,5,12,0.85)_90%)]" />
      )}
    </div>
  );
};
