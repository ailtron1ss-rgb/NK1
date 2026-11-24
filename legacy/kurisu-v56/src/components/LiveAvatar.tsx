/**
 * Live 2D with crossfade between sprite frames + emotion meters.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AvatarExpression } from '../types';
import { getOutfit, OutfitId, OUTFITS } from '../avatar/outfitCatalog';
import { resolveSpritePath } from '../avatar/spriteEngine';

interface Props {
  expression: AvatarExpression;
  isSpeaking: boolean;
  outfitId: OutfitId;
  emotions?: { trust: number; affection: number; irritation: number; curiosity: number };
  onOutfitClick?: () => void;
}

export const LiveAvatar: React.FC<Props> = ({
  expression,
  isSpeaking,
  outfitId,
  emotions,
  onOutfitClick
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const outfit = getOutfit(outfitId);
  const imgA = useRef<HTMLImageElement | null>(null);
  const imgB = useRef<HTMLImageElement | null>(null);
  const blendRef = useRef(1); // 0 = A, 1 = B showing
  const [ready, setReady] = useState(false);
  const targetUrl = useRef('');

  useEffect(() => {
    const preferLab = outfitId === 'lab_coat' || outfitId === 'formal';
    const url = resolveSpritePath(String(expression), preferLab);
    if (url === targetUrl.current) return;
    targetUrl.current = url;
    const im = new Image();
    im.onload = () => {
      // crossfade: current visible becomes A, new becomes B
      if (blendRef.current >= 0.95) {
        imgA.current = imgB.current;
      } else {
        imgA.current = imgB.current || imgA.current;
      }
      imgB.current = im;
      blendRef.current = 0;
      setReady(true);
    };
    im.onerror = () => setReady(!!imgB.current || !!imgA.current);
    im.src = url;
  }, [expression, outfitId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let anim = 0;
    let clock = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const minDelta = isSpeaking ? 33 : 50;
      if (now - last < minDelta) {
        anim = requestAnimationFrame(draw);
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;
      // ease crossfade
      if (blendRef.current < 1) {
        blendRef.current = Math.min(1, blendRef.current + dt * 2.2);
      }

      const w = (canvas.width = canvas.clientWidth || 320);
      const h = (canvas.height = canvas.clientHeight || 420);
      ctx.clearRect(0, 0, w, h);
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#14141c');
      g.addColorStop(1, '#08080c');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const breath = Math.sin(clock * 2) * 2;
      const cx = w / 2;
      const cy = h * 0.48 + breath;
      const blend = blendRef.current;

      const drawImg = (im: HTMLImageElement | null, alpha: number) => {
        if (!im || alpha < 0.02) return;
        const maxW = w * 0.92;
        const maxH = h * 0.82;
        const scale = Math.min(maxW / im.width, maxH / im.height);
        const dw = im.width * scale;
        const dh = im.height * scale;
        ctx.globalAlpha = alpha;
        ctx.drawImage(im, cx - dw / 2, cy - dh / 2 - 8, dw, dh);
        ctx.globalAlpha = 1;
        return { dw, dh };
      };

      const a = drawImg(imgA.current, 1 - blend);
      const b = drawImg(imgB.current, blend);
      const dim = b || a;

      if (!imgA.current && !imgB.current) {
        const c = outfit.colors;
        ctx.fillStyle = c.top;
        ctx.fillRect(cx - 50, cy, 100, 120);
        ctx.fillStyle = c.skin;
        ctx.beginPath();
        ctx.ellipse(cx, cy - 30, 40, 48, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      if (isSpeaking && dim) {
        ctx.strokeStyle = `rgba(255,59,48,${0.2 + 0.2 * Math.sin(clock * 8)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy + dim.dh * 0.35, dim.dw * 0.22, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (emotions) {
        const chips = [
          { l: 'TR', v: emotions.trust, c: '#5AC8FA' },
          { l: 'AF', v: emotions.affection, c: '#FF6B8A' },
          { l: 'IR', v: emotions.irritation, c: '#FF3B30' },
          { l: 'CU', v: emotions.curiosity, c: '#00FF94' }
        ];
        chips.forEach((ch, i) => {
          const x = 10;
          const y = h - 52 + i * 11;
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.fillRect(x, y, 70, 8);
          ctx.fillStyle = ch.c;
          ctx.fillRect(x, y, 70 * Math.min(1, ch.v / 100), 8);
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          ctx.font = '9px monospace';
          ctx.fillText(ch.l, x + 74, y + 7);
        });
      }

      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '10px monospace';
      ctx.fillText(`${outfit.nameRu} · ${String(expression).slice(0, 16)}`, 10, 16);

      anim = requestAnimationFrame(draw);
    };
    anim = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(anim);
  }, [expression, isSpeaking, outfitId, emotions, outfit, ready]);

  return (
    <div className="relative w-full h-full min-h-[300px] cursor-pointer" onClick={onOutfitClick}>
      <canvas ref={canvasRef} className="w-full h-full rounded-xl" />
      <div className="absolute bottom-2 right-2 text-[9px] font-mono text-white/50 bg-black/50 px-2 py-1 rounded">
        XFADE · SPRITE
      </div>
    </div>
  );
};

export const OutfitPicker: React.FC<{
  value: OutfitId;
  onChange: (id: OutfitId) => void;
  autoMode: boolean;
  onToggleAuto: () => void;
}> = ({ value, onChange, autoMode, onToggleAuto }) => (
  <div className="space-y-2 p-2">
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-mono text-white/60">Одежда / образ</span>
      <button
        type="button"
        onClick={onToggleAuto}
        className={`text-[10px] font-mono px-2 py-1 rounded border ${
          autoMode ? 'border-[#00FF94]/40 text-[#00FF94] bg-[#00FF94]/10' : 'border-white/15 text-white/50'
        }`}
      >
        {autoMode ? 'Авто: вкл' : 'Авто: выкл'}
      </button>
    </div>
    <div className="grid grid-cols-2 gap-1.5">
      {OUTFITS.map(o => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`text-left text-[10px] font-mono p-2 rounded-lg border ${
            value === o.id ? 'border-[#FF3B30]/50 bg-[#FF3B30]/15 text-white' : 'border-white/10 bg-white/5 text-white/70'
          }`}
        >
          <div className="font-bold">{o.nameRu}</div>
          <div className="text-white/40 truncate">{o.description}</div>
        </button>
      ))}
    </div>
  </div>
);
