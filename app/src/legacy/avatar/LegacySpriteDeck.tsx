import { useEffect, useRef, useState } from "react";
import { getOutfit, type VisualProfileId, OUTFITS } from "./outfitCatalog";
import { listAllSprites, resolveSpritePath } from "./spriteEngine";
import { readAvatarPreference, writeAvatarPreference } from "./safeLocalStorage";
import type { EmotionLabel } from "@/organism/types";

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

const AVAILABLE_SPRITES = listAllSprites();

function readStoredSprite(): string | null {
  const stored = readAvatarPreference("kurisu-legacy-sprite-id");
  return AVAILABLE_SPRITES.some((sprite) => sprite.id === stored) ? stored : null;
}

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

export function LegacySpriteDeck({ emotion, speaking }: { emotion: EmotionLabel; speaking: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentRef = useRef<HTMLImageElement | null>(null);
  const previousRef = useRef<HTMLImageElement | null>(null);
  const [outfit, setOutfit] = useState<VisualProfileId>(readStoredOutfit);
  const [spriteId, setSpriteId] = useState<string | null>(readStoredSprite);
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
    const url = resolveSpritePath(EXPRESSION[emotion] ?? "neutral", { preferLab: outfit === "lab_coat" || outfit === "formal", profile: getOutfit(outfit), spriteId });
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
  }, [emotion, outfit, spriteId]);

  useEffect(() => { persistOutfit(outfit); }, [outfit]);
  useEffect(() => { writeAvatarPreference("kurisu-legacy-sprite-id", spriteId ?? "auto"); }, [spriteId]);

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
      // Resizing clears the bitmap and resets the drawing context; only do it
      // when the layout dimensions actually change, not on every animation frame.
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
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
      if (speakingRef.current && d) {
        ctx.strokeStyle = `rgba(255,59,48,${0.20 + 0.2 * Math.sin(time * 8)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(cx, cy + d.dh * .35, d.dw * .22, 8, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.font = "10px monospace"; ctx.fillText(`${getOutfit(outfitRef.current).nameRu} · legacy visual`, 10, 16);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw); return () => cancelAnimationFrame(raf);
  }, []);

  return <div className="relative overflow-hidden rounded-xl border border-border bg-bg">
    <canvas ref={canvasRef} className="h-[320px] w-full md:h-[420px]" />
    <button type="button" onClick={() => setOpen((v) => !v)} className="absolute right-3 top-3 rounded-md border border-border bg-black/60 px-2.5 py-1 text-[10px] font-mono text-white/70 hover:text-white">
      {open ? "hide options" : ready ? "legacy deck" : "loading"}
    </button>
    {open ? <div className="absolute inset-x-3 bottom-3 z-30 max-h-[72%] overflow-y-auto rounded-lg border border-border bg-black/85 p-2 backdrop-blur">
      <div className="mb-2 text-[10px] uppercase tracking-wider text-white/50">visual legacy / profile catalog</div>
      <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
        {OUTFITS.map((item) => <button key={item.id} type="button" onClick={() => setOutfit(item.id)} className={`rounded-md border px-2 py-1.5 text-left text-[10px] ${outfit === item.id ? "border-accent bg-accent/15 text-white" : "border-white/10 text-white/65"}`}><div>{item.nameRu}</div><div className="truncate text-white/35">{item.description}</div></button>)}
      </div>
      <div className="mb-2 mt-3 flex flex-wrap items-center justify-between gap-2"><div className="text-[10px] uppercase tracking-wider text-white/50">Поза / локальный спрайт</div><button type="button" onClick={() => setSpriteId(null)} aria-pressed={spriteId === null} className={`rounded-md border px-2 py-1 text-[10px] ${spriteId === null ? "border-accent bg-accent/15 text-white" : "border-white/10 text-white/65"}`}>Авто по эмоции</button></div>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        {AVAILABLE_SPRITES.map((sprite) => <button key={sprite.id} type="button" onClick={() => setSpriteId(sprite.id)} aria-pressed={spriteId === sprite.id} title={sprite.label} className={`min-w-0 rounded-md border p-1 text-left ${spriteId === sprite.id ? "border-accent bg-accent/15" : "border-white/10 bg-white/[.025]"}`}><span className="flex h-14 items-center justify-center overflow-hidden rounded bg-black/30"><img src={sprite.path} alt="" loading="lazy" className="h-full w-full object-contain" /></span><span className="mt-1 block truncate text-[9px] text-white/70">{sprite.label}</span></button>)}
      </div>
    </div> : null}
  </div>;
}
