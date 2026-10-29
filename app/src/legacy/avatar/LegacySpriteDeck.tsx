import { useEffect, useRef, useState } from "react";
import { getOutfit, type VisualProfileId, OUTFITS } from "./outfitCatalog";
import { resolveSpritePath } from "./spriteEngine";
import { readAvatarPreference, writeAvatarPreference } from "./safeLocalStorage";
import type { ActionKind, EmotionLabel } from "@/organism/types";

const EXPRESSION: Record<EmotionLabel, string> = {
  curiosity: "thinking",
  calm: "neutral",
  joy: "happy",
  anxiety: "sad",
  frustration: "angry",
  sadness: "sad",
  anger: "angry",
  protective: "focused",
};

function readStoredOutfit(): VisualProfileId {
  const stored = readAvatarPreference("kurisu-visual-profile");
  return OUTFITS.some((profile) => profile.id === stored)
    ? stored as VisualProfileId
    : "lab_coat";
}

function persistOutfit(outfit: VisualProfileId): void {
  // Persistence is optional: the visual selector remains usable without browser storage.
  writeAvatarPreference("kurisu-visual-profile", outfit);
}

export function LegacySpriteDeck({
  emotion,
  speaking,
  action = "wait",
  thinking = false,
}: { emotion: EmotionLabel; speaking: boolean; action?: ActionKind; thinking?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentRef = useRef<HTMLImageElement | null>(null);
  const previousRef = useRef<HTMLImageElement | null>(null);
  const [outfit, setOutfit] = useState<VisualProfileId>(readStoredOutfit);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const blend = useRef(1);
  // Keep the canvas loop mounted across emotion/speech changes. These refs expose
  // current render values to the frame callback without restarting its clock.
  const speakingRef = useRef(speaking);
  const outfitRef = useRef(outfit);
  speakingRef.current = speaking;
  outfitRef.current = outfit;

  useEffect(() => {
    let cancelled = false;
    const visualAction = thinking ? "reflect" : speaking ? "respond" : action;
    const url = resolveSpritePath(EXPRESSION[emotion] ?? "neutral", {
      preferLab: outfit === "lab_coat" || outfit === "formal",
      profile: getOutfit(outfit),
      action: visualAction,
    });
    const img = new Image();
    img.onload = () => {
      // A slow prior request must not overwrite the newest emotion/outfit sprite.
      if (cancelled) return;
      previousRef.current = currentRef.current;
      currentRef.current = img;
      blend.current = 0;
      setReady(true);
    };
    img.onerror = () => {
      if (!cancelled) setReady(Boolean(currentRef.current));
    };
    img.src = url;
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [emotion, outfit]);

  useEffect(() => { persistOutfit(outfit); }, [outfit]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let time = 0;
    let last = performance.now();
    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
      blend.current = Math.min(1, blend.current + dt * 2.5);
      const w = canvas.clientWidth || 320;
      const h = canvas.clientHeight || 360;
      const rawDpr = Number(window.devicePixelRatio || 1);
      const dpr = Math.max(1, Math.min(2, Number.isFinite(rawDpr) ? rawDpr : 1));
      const bitmapWidth = Math.max(1, Math.round(w * dpr));
      const bitmapHeight = Math.max(1, Math.round(h * dpr));
      // Keep the backing bitmap sharp on phones; draw in logical CSS pixels.
      if (canvas.width !== bitmapWidth) canvas.width = bitmapWidth;
      if (canvas.height !== bitmapHeight) canvas.height = bitmapHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.clearRect(0, 0, w, h);
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#14141c"); g.addColorStop(1, "#08080c"); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h * 0.50 + Math.sin(time * 2) * 2;
      const drawImage = (img: HTMLImageElement | null, alpha: number) => {
        if (!img || alpha < 0.01) return null;
        const scale = Math.min((w * .92) / img.width, (h * .82) / img.height);
        const dw = img.width * scale, dh = img.height * scale;
        ctx.globalAlpha = alpha; ctx.drawImage(img, cx - dw / 2, cy - dh / 2 - 8, dw, dh); ctx.globalAlpha = 1;
        return { dw, dh };
      };
      const a = drawImage(previousRef.current, 1 - blend.current);
      const b = drawImage(currentRef.current, blend.current);
      const d = b || a;
      if (!d) {
        ctx.fillStyle = "rgba(255,255,255,.68)";
        ctx.textAlign = "center";
        ctx.font = "12px monospace";
        ctx.fillText("Legacy sprite asset unavailable", cx, cy);
        ctx.textAlign = "start";
      }
      // These are complete still illustrations, not mouth-rigged frames.
      ctx.fillStyle = "rgba(255,255,255,.68)";
      ctx.font = "10px monospace";
      ctx.fillText(`${getOutfit(outfitRef.current).nameRu} · ${speakingRef.current ? "говорит · статичный кадр" : "поза по действию"}`, 10, 16);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw); return () => cancelAnimationFrame(raf);
  }, []);

  return <div className="relative overflow-hidden rounded-xl border border-border bg-bg">
    <canvas ref={canvasRef} className="h-[320px] w-full md:h-[420px]" />
    <button type="button" onClick={() => setOpen((v) => !v)} className="absolute right-3 top-3 rounded-md border border-border bg-black/60 px-2.5 py-1 text-[10px] font-mono text-white/70 hover:text-white">
      {open ? "hide outfit" : ready ? "legacy deck" : "loading"}
    </button>
    {open ? <div className="absolute inset-x-3 bottom-3 rounded-lg border border-border bg-black/75 p-2 backdrop-blur">
      <div className="mb-2 text-[10px] uppercase tracking-wider text-white/50">visual legacy / profile catalog</div>
      <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
        {OUTFITS.map((item) => <button key={item.id} type="button" onClick={() => setOutfit(item.id)} className={`rounded-md border px-2 py-1.5 text-left text-[10px] ${outfit === item.id ? "border-accent bg-accent/15 text-white" : "border-white/10 text-white/65"}`}><div>{item.nameRu}</div><div className="truncate text-white/35">{item.description}</div></button>)}
      </div>
    </div> : null}
  </div>;
}
