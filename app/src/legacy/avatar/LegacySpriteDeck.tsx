import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { getOutfit, type VisualProfileId, OUTFITS } from "./outfitCatalog";
import { resolveSpritePath } from "./spriteEngine";
import { readAvatarPreference, writeAvatarPreference } from "./safeLocalStorage";
import type { ActionKind, EmotionLabel } from "@/organism/types";

type SpriteAssetStatus = "loading" | "ready" | "error";

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
  interaction = null,
  onContact,
}: { emotion: EmotionLabel; speaking: boolean; action?: ActionKind; thinking?: boolean; interaction?: { zone: "head" | "body"; pulse01: number; evidenceId: string } | null; onContact?: (contact: { zone: "head" | "body"; nx: number; ny: number }) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentRef = useRef<HTMLImageElement | null>(null);
  const previousRef = useRef<HTMLImageElement | null>(null);
  const [outfit, setOutfit] = useState<VisualProfileId>("lab_coat");
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  const [open, setOpen] = useState(false);
  const [assetStatus, setAssetStatus] = useState<SpriteAssetStatus>("loading");
  const blend = useRef(1);
  // Keep the canvas loop mounted across emotion/speech changes. These refs expose
  // current render values to the frame callback without restarting its clock.
  const speakingRef = useRef(speaking);
  const outfitRef = useRef(outfit);
  const interactionRef = useRef(interaction);
  const imageLayoutRef = useRef<{ left: number; top: number; width: number; height: number } | null>(null);
  speakingRef.current = speaking;
  outfitRef.current = outfit;
  interactionRef.current = interaction;

  useEffect(() => {
    let cancelled = false;
    setAssetStatus("loading");
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
      setAssetStatus("ready");
    };
    img.onerror = () => {
      // Keep the last good frame visible; report that the requested replacement failed.
      if (!cancelled) setAssetStatus("error");
    };
    img.src = url;
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [emotion, outfit, action, thinking, speaking]);

  useEffect(() => {
    setOutfit(readStoredOutfit());
    setPreferencesHydrated(true);
  }, []);

  useEffect(() => {
    if (!preferencesHydrated) return;
    persistOutfit(outfit);
  }, [outfit, preferencesHydrated]);

  const handleCanvasPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const layout = imageLayoutRef.current;
    const canvas = canvasRef.current;
    if (!layout || !canvas || !onContact) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < layout.left || x > layout.left + layout.width || y < layout.top || y > layout.top + layout.height) return;
    const nx = Math.max(0, Math.min(1, x / Math.max(1, rect.width)));
    const ny = Math.max(0, Math.min(1, y / Math.max(1, rect.height)));
    const withinSpriteY = (y - layout.top) / Math.max(1, layout.height);
    onContact({ zone: withinSpriteY <= .43 ? "head" : "body", nx, ny });
  };

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
        const top = cy - dh / 2 - 8;
        const left = cx - dw / 2;
        ctx.globalAlpha = alpha; ctx.drawImage(img, left, top, dw, dh); ctx.globalAlpha = 1;
        return { dw, dh, top, left };
      };
      const a = drawImage(previousRef.current, 1 - blend.current);
      const b = drawImage(currentRef.current, blend.current);
      const d = b || a;
      imageLayoutRef.current = d ? { left: d.left, top: d.top, width: d.dw, height: d.dh } : null;
      if (!d) {
        ctx.fillStyle = "rgba(255,255,255,.68)";
        ctx.textAlign = "center";
        ctx.font = "12px monospace";
        ctx.fillText("Legacy sprite asset unavailable", cx, cy);
        ctx.textAlign = "start";
      }
      // Legacy images are stills, so acknowledge a real contact observation with
      // a short zone halo instead of pretending the sprite has a deformable rig.
      const touch = interactionRef.current;
      if (d && touch && Number.isFinite(touch.pulse01) && touch.pulse01 > 0) {
        const contactY = d.top + d.dh * (touch.zone === "head" ? .22 : .64);
        const baseRadius = Math.max(8, Math.min(d.dw, d.dh) * .085);
        const radius = baseRadius + Math.sin(time * 7) * 2 + (1 - touch.pulse01) * 5;
        const alpha = Math.max(0, Math.min(.42, touch.pulse01 * .38));
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = "rgba(114, 226, 238, .95)";
        ctx.lineWidth = 1.8;
        ctx.shadowBlur = 9;
        ctx.shadowColor = "rgba(91, 219, 235, .75)";
        ctx.beginPath();
        ctx.arc(cx, contactY, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = alpha * .58;
        ctx.beginPath();
        ctx.arc(cx, contactY, radius * .68, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
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
    <canvas ref={canvasRef} onPointerUp={handleCanvasPointerUp} role="img" aria-label="Курису. Нажмите на голову или корпус, чтобы передать сенсорное событие." className="h-[320px] w-full touch-manipulation md:h-[420px]" />
    <span role="status" aria-live="polite" className="sr-only">
      {assetStatus === "error"
        ? currentRef.current ? "Не удалось загрузить новый спрайт; предыдущий кадр сохранён." : "Не удалось загрузить спрайт."
        : assetStatus === "ready" ? "Спрайт загружен." : "Загрузка спрайта."}
    </span>
    <button
      type="button"
      aria-label={open ? "Скрыть каталог одежды Курису" : "Открыть каталог одежды Курису"}
      aria-expanded={open}
      aria-controls="legacy-outfit-options"
      onClick={() => setOpen((v) => !v)}
      className="absolute right-3 top-3 rounded-md border border-border bg-black/60 px-2.5 py-1 text-[10px] font-mono text-white/70 hover:text-white"
    >
      {open ? "hide outfit" : assetStatus === "ready" ? "legacy deck" : assetStatus === "error" ? "assets unavailable" : "loading"}
    </button>
    {open ? <div id="legacy-outfit-options" role="group" aria-label="Выбор одежды и визуального профиля" className="absolute inset-x-3 bottom-3 rounded-lg border border-border bg-black/75 p-2 backdrop-blur">
      <div className="mb-2 text-[10px] uppercase tracking-wider text-white/50">visual legacy / profile catalog</div>
      <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
        {OUTFITS.map((item) => <button key={item.id} type="button" aria-pressed={outfit === item.id} onClick={() => setOutfit(item.id)} className={`rounded-md border px-2 py-1.5 text-left text-[10px] ${outfit === item.id ? "border-accent bg-accent/15 text-white" : "border-white/10 text-white/65"}`}><div>{item.nameRu}</div><div className="truncate text-white/35">{item.description}</div></button>)}
      </div>
    </div> : null}
  </div>;
}
