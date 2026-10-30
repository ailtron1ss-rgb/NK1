import { useEffect, useState } from "react";
import type { EmotionLabel, ActionKind } from "@/organism/types";
import { readAvatarPreference, writeAvatarPreference } from "@/legacy/avatar/safeLocalStorage";
import type { MouthPose } from "./avatar/embodimentTimeline";
import { deriveAvatar25DDepthOffsets, svgTranslate } from "./avatar/avatar25dDepth";

type Outfit = "lab" | "casual" | "night";
type EyeTone = "ice" | "violet" | "teal";
type HairTone = "copper" | "wine";
type AccentTone = "cyan" | "rose" | "lime";
type MotionStyle = "soft" | "expressive";
type PoseOverride = "auto" | "crossed" | "thinking" | "explain";

const OUTFITS: ReadonlyArray<{ id: Outfit; label: string }> = [
  { id: "lab", label: "Лаборатория" },
  { id: "casual", label: "Город" },
  { id: "night", label: "Ночной режим" },
];
const EYES: ReadonlyArray<{ id: EyeTone; label: string; color: string }> = [
  { id: "ice", label: "Лёд", color: "#8bdcff" },
  { id: "violet", label: "Аметист", color: "#b5a4ff" },
  { id: "teal", label: "Морская волна", color: "#5be5ce" },
];
const HAIR: ReadonlyArray<{ id: HairTone; label: string; main: string; shade: string }> = [
  { id: "copper", label: "Медный", main: "#a94732", shade: "#54272c" },
  { id: "wine", label: "Красное дерево", main: "#783744", shade: "#351e32" },
];
const ACCENTS: ReadonlyArray<{ id: AccentTone; label: string; color: string }> = [
  { id: "cyan", label: "Циан", color: "#57e4e8" },
  { id: "rose", label: "Розовый", color: "#ff7db8" },
  { id: "lime", label: "Лайм", color: "#c4f77c" },
];
const MOTIONS: ReadonlyArray<{ id: MotionStyle; label: string }> = [
  { id: "soft", label: "Плавное" },
  { id: "expressive", label: "Выразительное" },
];
const POSES: ReadonlyArray<{ id: PoseOverride; label: string }> = [
  { id: "auto", label: "Авто" },
  { id: "crossed", label: "Скрестить руки" },
  { id: "thinking", label: "Думать" },
  { id: "explain", label: "Объяснять" },
];

function stored<T extends string>(key: string, choices: ReadonlyArray<{ id: T }>, fallback: T): T {
  const value = readAvatarPreference(key);
  return choices.some((choice) => choice.id === value) ? value as T : fallback;
}

const EMOTION_MOUTH: Record<EmotionLabel, string> = {
  curiosity: "M196 158 Q210 164 224 158",
  calm: "M198 159 Q210 161 222 159",
  joy: "M195 156 Q210 174 225 156",
  anxiety: "M198 162 Q210 154 222 162",
  frustration: "M197 162 Q210 158 223 162",
  sadness: "M197 164 Q210 154 223 164",
  anger: "M198 163 L222 158",
  protective: "M197 159 Q210 165 223 159",
};

const EMOTION_BROW: Record<EmotionLabel, number> = {
  curiosity: -5, calm: 0, joy: 2, anxiety: 4, frustration: 8, sadness: 6, anger: 10, protective: -2,
};

function automaticPoseFor(action: ActionKind, emotion: EmotionLabel, thinking: boolean): PoseOverride {
  if (thinking || action === "reflect" || emotion === "curiosity" || action === "verify") return "thinking";
  if (action === "explore" || (action === "respond" && (emotion === "joy" || emotion === "protective"))) return "explain";
  if (emotion === "anger" || emotion === "frustration") return "crossed";
  return "auto";
}

function poseFor(action: ActionKind, emotion: EmotionLabel, arousal: number, motion: MotionStyle) {
  const multiplier = motion === "soft" ? 0.55 : 1;
  const actionTilt: Record<ActionKind, number> = {
    respond: 0, explore: 5, verify: 2, rest: -4, reflect: -7, wait: -1,
  };
  const emotionTilt: Record<EmotionLabel, number> = {
    curiosity: -3, calm: 0, joy: 2, anxiety: -2, frustration: 2, sadness: 4, anger: 1, protective: -1,
  };
  const energy = Math.max(0, Math.min(1, Number.isFinite(arousal) ? arousal : 0.25));
  return {
    head: (actionTilt[action] + emotionTilt[emotion]) * multiplier,
    body: (actionTilt[action] * 0.22 + (energy - 0.4) * 1.5) * multiplier,
    breathMs: Math.max(2.8, 4.6 - energy * 1.3),
  };
}

export interface KurisuOriginalStageProps {
  emotion: EmotionLabel;
  action: ActionKind;
  arousal: number;
  gazeX: number;
  gazeY: number;
  speaking: boolean;
  mouthPose: MouthPose;
  thinking: boolean;
}

/**
 * Independently authored, editable NK1 2.5D depth/parallax SVG preview.
 * This is not a Live2D .moc3 or production Cubism rig; it uses distinct
 * vector depth layers driven by organism gaze and the existing audio-timed
 * mouth signal while original layered PSD/occlusion-mask artwork is authored.
 */
export function KurisuOriginalStage({ emotion, action, arousal, gazeX, gazeY, speaking, mouthPose, thinking }: KurisuOriginalStageProps) {
  const [outfit, setOutfit] = useState<Outfit>(() => stored("kurisu-original-outfit", OUTFITS, "lab"));
  const [eyeTone, setEyeTone] = useState<EyeTone>(() => stored("kurisu-original-eyes", EYES, "violet"));
  const [hairTone, setHairTone] = useState<HairTone>(() => stored("kurisu-original-hair", HAIR, "copper"));
  const [accentTone, setAccentTone] = useState<AccentTone>(() => stored("kurisu-original-accent", ACCENTS, "cyan"));
  const [motion, setMotion] = useState<MotionStyle>(() => stored("kurisu-original-motion", MOTIONS, "soft"));
  const [poseOverride, setPoseOverride] = useState<PoseOverride>(() => stored("kurisu-original-pose", POSES, "auto"));
  const [scale, setScale] = useState(() => {
    const saved = Number(readAvatarPreference("kurisu-original-scale"));
    return Number.isFinite(saved) && saved >= 0.85 && saved <= 1.15 ? saved : 1;
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const hair = HAIR.find((choice) => choice.id === hairTone) ?? HAIR[0];
  const eyes = EYES.find((choice) => choice.id === eyeTone) ?? EYES[0];
  const accent = ACCENTS.find((choice) => choice.id === accentTone) ?? ACCENTS[0];
  const pose = poseFor(action, emotion, arousal, motion);
  const effectivePose = poseOverride === "auto" ? automaticPoseFor(action, emotion, thinking) : poseOverride;
  const mouthHeight = speaking ? Math.max(2, Math.min(14, mouthPose.open * 18)) : 2.5;
  const pupilOffsetX = Math.max(-0.4, Math.min(0.4, Number.isFinite(gazeX) ? gazeX : 0)) * 15;
  const pupilOffsetY = Math.max(-0.4, Math.min(0.4, Number.isFinite(gazeY) ? gazeY : 0)) * 10;
  const depth = deriveAvatar25DDepthOffsets(gazeX, gazeY, motion === "soft" ? 0.72 : 1);
  const browLift = EMOTION_BROW[emotion];
  const moodLabel: Record<EmotionLabel, string> = {
    curiosity: "интерес", calm: "спокойствие", joy: "радость", anxiety: "тревога",
    frustration: "раздражение", sadness: "грусть", anger: "злость", protective: "забота",
  };

  useEffect(() => {
    writeAvatarPreference("kurisu-original-outfit", outfit);
    writeAvatarPreference("kurisu-original-eyes", eyeTone);
    writeAvatarPreference("kurisu-original-hair", hairTone);
    writeAvatarPreference("kurisu-original-accent", accentTone);
    writeAvatarPreference("kurisu-original-motion", motion);
    writeAvatarPreference("kurisu-original-pose", poseOverride);
    writeAvatarPreference("kurisu-original-scale", String(scale));
  }, [outfit, eyeTone, hairTone, accentTone, motion, poseOverride, scale]);

  const isLab = outfit === "lab";
  const isNight = outfit === "night";
  const coat = isLab ? "#f1f4f5" : isNight ? "#1c3442" : "#a87962";
  const coatShadow = isLab ? "#bdcbd0" : isNight ? "#10232f" : "#674b4d";
  const shirt = isNight ? "#c4d7db" : "#f4f0e9";
  const tie = isNight ? "#67d6d3" : "#b52b43";
  const motionDuration = motion === "soft" ? "5.2s" : "3.1s";

  return (
    <div className="relative min-h-[320px] overflow-hidden rounded-xl border border-border bg-[#07131b] md:min-h-[420px]" data-testid="kurisu-original-stage">
      <style>{`
        @keyframes nk-float { 0%,100% { transform: translateY(0px) } 50% { transform: translateY(-3.5px) } }
        @keyframes nk-hair { 0%,100% { transform: rotate(-.45deg) } 50% { transform: rotate(.65deg) } }
        @keyframes nk-breath { 0%,100% { transform: translateY(0px) } 50% { transform: translateY(1.8px) } }
        @keyframes nk-scanner { 0% { transform: translateY(-35px); opacity: 0 } 15% { opacity: .5 } 85% { opacity: .28 } 100% { transform: translateY(255px); opacity: 0 } }
        @keyframes nk-blink { 0%, 44%, 47%, 100% { transform: scaleY(1) } 45.2%, 46.2% { transform: scaleY(.035) } }
        .nk-eye { transform-box: fill-box; transform-origin: center; animation: nk-blink 6.2s ease-in-out infinite; }
        .nk-eye-right { animation-delay: .08s; }
        .nk-float { animation: nk-float ${motionDuration} ease-in-out infinite; transform-origin: 210px 270px; }
        .nk-hair { animation: nk-hair 6.2s ease-in-out infinite; transform-origin: 210px 110px; }
        .nk-breath { animation: nk-breath ${pose.breathMs}s ease-in-out infinite; transform-origin: 210px 240px; }
        .nk-scanner { animation: nk-scanner 8s linear infinite; }
        .nk-depth-layer { transition: transform 320ms cubic-bezier(.2,.7,.2,1); transform-box: view-box; }
        @media (prefers-reduced-motion: reduce) { .nk-depth-layer { transform: none !important; transition: none !important; } }
        @media (prefers-reduced-motion: reduce) { .nk-float,.nk-hair,.nk-breath,.nk-scanner,.nk-eye { animation: none !important; } }
      `}</style>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_36%,rgba(38,113,133,.35),transparent_47%),linear-gradient(180deg,#0a1b25,#050b12)]" />
      <svg viewBox="0 0 420 560" role="img" aria-label={`NK1 Original — Курису, ${moodLabel[emotion]}, ${OUTFITS.find((item) => item.id === outfit)?.label}`} className="relative z-10 h-[320px] w-full md:h-[420px]" preserveAspectRatio="xMidYMid meet" style={{ transform: `scale(${scale})`, transformOrigin: "50% 55%", transition: "transform 180ms ease" }}>
        <defs>
          <linearGradient id="nk-hair" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={hair.main}/><stop offset="54%" stopColor="#c86645"/><stop offset="100%" stopColor={hair.shade}/></linearGradient>
          <linearGradient id="nk-coat" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={coatShadow}/><stop offset="48%" stopColor={coat}/><stop offset="100%" stopColor={coatShadow}/></linearGradient>
          <linearGradient id="nk-skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffe1cf"/><stop offset="100%" stopColor="#dca59c"/></linearGradient>
          <linearGradient id="nk-iris" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e8fbff"/><stop offset="42%" stopColor={eyes.color}/><stop offset="100%" stopColor="#3d6182"/></linearGradient>
          <pattern id="nk-grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke={accent.color} strokeOpacity=".11" strokeWidth=".6"/></pattern>
          <filter id="nk-glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="420" height="560" fill="url(#nk-grid)"/>
        <circle cx="210" cy="270" r="176" fill="none" stroke={accent.color} strokeOpacity=".16" strokeWidth="1"/>
        <circle cx="210" cy="270" r="152" fill="none" stroke={accent.color} strokeOpacity=".10" strokeDasharray="3 8"/>
        <g opacity=".48" fill={accent.color} fontFamily="monospace" fontSize="8">
          <text x="22" y="45">NK1 / EMBODIMENT</text><text x="22" y="57">AFFECTIVE RIG v1</text>
          <text x="310" y="45">MODE 2.5D</text><text x="310" y="57">STATE: {emotion.toUpperCase()}</text>
          <text x="22" y="510">POSE / {action.toUpperCase()}</text><text x="310" y="510">AROUSAL {(Math.max(0, Math.min(1, arousal)) * 100).toFixed(0)}%</text>
        </g>
        <path className="nk-scanner" d="M20 80H400" stroke={accent.color} strokeOpacity=".42" strokeWidth="1"/>
        <ellipse cx="210" cy="505" rx="78" ry="9" fill={accent.color} opacity=".12" filter="url(#nk-glow)"/>
        <g className="nk-float">
          <g style={{ transform: `rotate(${poseOverride === "auto" ? pose.body : 0}deg)`, transformOrigin: "210px 280px", transition: "transform 700ms ease" }}>
          {/* Rear hair silhouette and long, independently swinging locks. */}
          <g className="nk-depth-layer nk-depth-rear-hair" data-depth-layer="rear-hair" transform={svgTranslate(depth.rearHair)}><g className="nk-hair">
            <path d="M150 79 Q145 38 192 29 Q246 24 273 67 Q289 104 272 180 L292 311 Q265 348 249 317 L241 205 L179 208 L170 321 Q147 348 131 308 L143 173 Q130 122 150 79Z" fill="url(#nk-hair)" stroke={hair.shade} strokeWidth="2"/>
            <path d="M159 83 Q156 43 197 36 Q229 33 251 61 Q235 48 220 47 Q178 44 164 101Z" fill="#e58c61" opacity=".48"/>
            <path d="M151 113 Q160 170 149 244 L140 302 M264 116 Q254 184 272 283" fill="none" stroke="#ef9b70" strokeOpacity=".55" strokeWidth="3" strokeLinecap="round"/>
          </g></g>
          {/* Legs, tights and boots. */}
          <path d="M171 355 L205 360 L201 448 Q197 466 188 475 L167 475 Q167 461 176 446 L166 392Z" fill="#262833" stroke="#12161c" strokeWidth="2"/>
          <path d="M215 360 L248 354 L250 411 Q251 441 266 460 L264 475 L242 475 Q226 455 225 430Z" fill="#262833" stroke="#12161c" strokeWidth="2"/>
          <path d="M165 465 Q183 468 195 463 L193 491 Q182 498 158 492 L159 479Z" fill="#101a26" stroke="#627582" strokeWidth="2"/>
          <path d="M240 464 Q255 468 267 458 L282 483 Q274 496 247 493 L239 482Z" fill="#101a26" stroke="#627582" strokeWidth="2"/>
          <path d="M160 480 L190 482 L185 489 L163 489Z M247 480 L274 475 L276 484 L252 489Z" fill={accent.color} opacity=".8"/>
          {/* Torso and coat silhouette changes by outfit; all are separately authored shapes. */}
          {isLab ? <g>
            <path d="M163 186 Q184 174 208 179 Q238 175 260 188 L278 361 L250 391 L221 369 L209 321 L197 369 L165 392 L137 363Z" fill="url(#nk-coat)" stroke={coatShadow} strokeWidth="2"/>
            <path d="M163 192 L181 204 L177 345 L161 371 L145 359Z" fill="#fff" opacity=".56"/>
            <path d="M258 193 L242 204 L247 346 L263 370 L275 358Z" fill="#a9bac1" opacity=".46"/>
          </g> : isNight ? <g>
            <path d="M164 190 Q178 174 207 183 Q239 174 259 190 L274 372 Q243 391 210 377 Q177 391 145 372Z" fill={coat} stroke={coatShadow} strokeWidth="3"/>
            <path d="M171 185 Q176 157 211 158 Q248 161 252 188 L237 207 L185 206Z" fill={coatShadow}/>
            <path d="M193 198 L225 198 L222 256 L209 268 L196 256Z" fill={shirt}/>
          </g> : <g>
            <path d="M163 190 Q180 176 208 183 Q238 176 259 190 L276 350 L248 374 L219 352 L209 311 L197 352 L167 374 L140 350Z" fill={coat} stroke={coatShadow} strokeWidth="3"/>
            <path d="M174 194 L188 203 L182 338 L166 354 L151 342Z" fill="#d5b3a0" opacity=".55"/>
            <path d="M246 194 L231 205 L237 337 L252 353 L267 341Z" fill={coatShadow} opacity=".46"/>
          </g>}
          <g className="nk-depth-layer nk-depth-torso" data-depth-layer="torso" transform={svgTranslate(depth.torso)}><g className="nk-breath">
            {/* Pose presets change the limb silhouettes; Auto follows organism action/emotion. */}
            {effectivePose === "crossed" ? <g>
              <path d="M164 196 Q148 194 149 216 L177 252 Q198 269 218 253 L209 234 Q198 246 185 234 L174 210Z" fill={coat} stroke={coatShadow} strokeWidth="2"/>
              <path d="M257 196 Q273 195 272 216 L242 252 Q221 269 201 253 L211 234 Q224 246 236 234 L247 210Z" fill={coat} stroke={coatShadow} strokeWidth="2"/>
              <path d="M176 250 Q195 263 210 251 Q224 263 241 247" fill="none" stroke="url(#nk-skin)" strokeWidth="10" strokeLinecap="round"/>
              <path d="M189 246 Q208 252 226 244" fill="none" stroke="#bd8283" strokeWidth="1.8" strokeLinecap="round"/>
            </g> : effectivePose === "thinking" ? <g>
              <path d="M164 196 Q148 194 144 216 L129 288 Q126 303 136 307 Q145 307 150 291 L170 232Z" fill="url(#nk-skin)" stroke="#b77e7b" strokeWidth="1.5"/>
              <path d="M132 275 L151 280 L145 298 Q139 309 131 303 Q126 294 132 275Z" fill={coat}/>
              <path d="M137 302 L141 319 L147 314 L148 304" fill="none" stroke="#dca59c" strokeWidth="2" strokeLinecap="round"/>
              <path d="M257 196 Q273 195 278 216 L267 239 L250 232 L250 214Z" fill={coat} stroke={coatShadow} strokeWidth="1.5"/>
              <path d="M262 228 L246 203 Q241 195 247 190 Q254 187 260 198 L275 220Z" fill="url(#nk-skin)" stroke="#b77e7b" strokeWidth="1.5"/>
              <path d="M248 202 L239 181 Q235 172 230 168 Q224 162 229 157 Q235 153 241 162 L257 182 L266 214Z" fill="url(#nk-skin)" stroke="#b77e7b" strokeWidth="1.5"/>
              <path d="M225 166 Q233 158 240 166 L244 174 Q237 180 230 175Z" fill="url(#nk-skin)" stroke="#b77e7b" strokeWidth="1.2"/>
            </g> : effectivePose === "explain" ? <g>
              <path d="M164 196 Q148 194 144 216 L129 242 Q121 253 112 246 Q104 240 113 231 L141 204 Q151 190 170 197Z" fill={coat} stroke={coatShadow} strokeWidth="1.5"/>
              <path d="M125 239 L110 232 Q102 228 99 221 Q97 214 104 212 Q111 211 117 218 L138 224Z" fill="url(#nk-skin)" stroke="#b77e7b" strokeWidth="1.5"/>
              <path d="M257 196 Q273 195 278 216 L291 287 Q294 302 284 307 Q276 307 270 290 L251 232Z" fill="url(#nk-skin)" stroke="#b77e7b" strokeWidth="1.5"/>
              <path d="M270 280 L289 274 L294 296 Q289 310 281 303Z" fill={coat}/>
              <path d="M284 303 L280 320 L274 314 L274 304" fill="none" stroke="#dca59c" strokeWidth="2" strokeLinecap="round"/>
            </g> : <g>
              <path d="M164 196 Q148 194 144 216 L129 288 Q126 303 136 307 Q145 307 150 291 L170 232Z" fill="url(#nk-skin)" stroke="#b77e7b" strokeWidth="1.5"/>
              <path d="M257 196 Q273 195 278 216 L291 287 Q294 302 284 307 Q276 307 270 290 L251 232Z" fill="url(#nk-skin)" stroke="#b77e7b" strokeWidth="1.5"/>
              <path d="M132 275 L151 280 L145 298 Q139 309 131 303 Q126 294 132 275Z" fill={coat}/>
              <path d="M270 280 L289 274 L294 296 Q289 310 281 303Z" fill={coat}/>
              <path d="M137 302 L141 319 L147 314 L148 304 M284 303 L280 320 L274 314 L274 304" fill="none" stroke="#dca59c" strokeWidth="2" strokeLinecap="round"/>
            </g>}
            {isLab ? <path d="M179 191 L196 207 L209 244 L224 207 L241 191 L229 255 L210 281 L190 255Z" fill="#f7f9f9" stroke="#b9c7cc" strokeWidth="1.5"/> : <path d="M184 191 L199 208 L210 244 L224 207 L238 191 L229 250 L210 275 L190 250Z" fill={shirt} stroke={coatShadow} strokeWidth="1.5"/>}
            <path d="M198 205 L221 205 L216 226 L211 241 L205 226Z" fill={tie}/>
            <path d="M205 239 L211 243 L217 239 L226 295 L210 315 L194 295Z" fill={tie} stroke="#572b3b" strokeWidth="1.2"/>
            <path d="M206 251 L210 291" stroke="#ffb4bd" strokeOpacity=".52" strokeWidth="2"/>
            {isLab ? <g fill="none" stroke={coatShadow} strokeWidth="1.5"><path d="M159 290 L189 297 M232 297 L261 289"/><path d="M165 340 L193 337 M227 337 L253 340"/></g> : null}
            {!isNight ? <path d="M189 356 L231 356 L244 385 Q210 400 176 385Z" fill="#20232d" stroke="#10131b" strokeWidth="2"/> : null}
            {/* One small NK1 accent keeps the editable concept distinct without duplicating the hair ornament. */}
            <path d="M248 280 L259 280 L256 287 L247 287Z" fill={accent.color}/>
          </g></g>
          {/* Face and separate features. */}
          <g className="nk-depth-layer nk-depth-head" data-depth-layer="head" transform={svgTranslate(depth.head)}>
          <g style={{ transform: `rotate(${pose.head}deg)`, transformOrigin: "210px 134px", transition: "transform 450ms ease" }}>
            <path d="M151 79 Q151 42 193 40 Q235 35 263 69 Q272 96 257 145 Q247 177 211 185 Q178 177 163 147 Q148 120 151 79Z" fill="url(#nk-skin)" stroke="#9f6267" strokeWidth="2"/>
            <path d="M151 85 Q153 47 192 39 Q236 33 263 69 L267 96 Q241 68 216 66 Q187 66 155 101Z" fill="url(#nk-hair)"/>
            <path d="M157 72 Q168 48 195 44 Q222 40 245 60 Q216 51 201 59 Q178 65 157 88Z" fill="#ee9d6c" opacity=".65"/>
            {/* Eye line, lids and iris are separately parameterizable shapes. */}
            <g transform="translate(179 118)">
              <g className="nk-eye nk-eye-left"><path d={emotion === "anger" || emotion === "frustration" ? "M-14 -2 Q0 -13 15 -1 Q2 10 -14 -2Z" : "M-15 0 Q0 -14 15 0 Q2 12 -15 0Z"} fill="#fff9f1" stroke="#67424b" strokeWidth="1.6"/>
              <g transform={`translate(${pupilOffsetX} ${pupilOffsetY})`}> <ellipse cx="1" cy="0" rx="6.5" ry="9" fill="url(#nk-iris)"/><ellipse cx="1" cy="1" rx="3.5" ry="6.5" fill="#2a354b"/><circle cx="3" cy="-4" r="2.5" fill="#fff"/> </g></g>
              <path d={`M-16 -1 Q0 ${-11-browLift} 16 -1`} fill="none" stroke={hair.shade} strokeWidth="3" strokeLinecap="round"/>
            </g>
            <g transform="translate(241 118)">
              <g className="nk-eye nk-eye-right"><path d={emotion === "anger" || emotion === "frustration" ? "M-15 -1 Q0 -13 14 -2 Q3 11 -15 -1Z" : "M-15 0 Q0 -14 15 0 Q2 12 -15 0Z"} fill="#fff9f1" stroke="#67424b" strokeWidth="1.6"/>
              <g transform={`translate(${pupilOffsetX} ${pupilOffsetY})`}> <ellipse cx="-1" cy="0" rx="6.5" ry="9" fill="url(#nk-iris)"/><ellipse cx="-1" cy="1" rx="3.5" ry="6.5" fill="#2a354b"/><circle cx="1" cy="-4" r="2.5" fill="#fff"/> </g></g>
              <path d={`M-16 -1 Q0 ${-11+browLift*.25} 16 -1`} fill="none" stroke={hair.shade} strokeWidth="3" strokeLinecap="round"/>
            </g>
            <path d="M210 127 L206 143 L212 145" fill="none" stroke="#bb7b7c" strokeWidth="1.6" strokeLinecap="round"/>
            {speaking ? <g>
              <ellipse cx="210" cy="160" rx={5 + Math.abs(mouthPose.form) * 4} ry={mouthHeight} fill="#5d2038" stroke="#8b4559" strokeWidth="1.2"/>
              <ellipse cx="210" cy={160 + mouthHeight * .45} rx="5" ry={Math.max(1, mouthHeight*.28)} fill="#e97d95" opacity=".92"/>
            </g> : <path d={EMOTION_MOUTH[emotion]} fill="none" stroke="#914657" strokeWidth="2.1" strokeLinecap="round"/>}
            {(emotion === "joy" || emotion === "anxiety" || emotion === "protective") ? <g fill="#ec8998" opacity=".32"><ellipse cx="170" cy="143" rx="10" ry="4"/><ellipse cx="250" cy="143" rx="10" ry="4"/></g> : null}
            {effectivePose === "thinking" ? <g>
              <path d="M236 179 Q230 173 234 166 L245 156 Q251 153 256 158 L252 170 L246 184Z" fill="url(#nk-skin)" stroke="#b77e7b" strokeWidth="1.4"/>
              <path d="M238 170 L248 162 M241 176 L250 169" fill="none" stroke="#c58c86" strokeWidth="1.4" strokeLinecap="round"/>
            </g> : null}
            {/* Loose front fringe with asymmetry to reinforce the NK1 silhouette. */}
            <g className="nk-depth-layer nk-depth-front-fringe" data-depth-layer="front-fringe" transform={svgTranslate(depth.frontFringe)}>
            <path d="M153 92 Q151 48 187 39 Q224 32 255 58 L268 89 L248 77 L240 104 L226 82 L207 111 L195 76 L177 107 L171 88Z" fill="url(#nk-hair)" stroke={hair.shade} strokeWidth="1.5"/>
            <path d="M160 70 Q177 46 195 44 M208 43 Q231 44 249 64" fill="none" stroke="#f0a06f" strokeOpacity=".58" strokeWidth="2.5" strokeLinecap="round"/>
            </g>
            {/* Slim red hair clip is closer to Kurisu's recognizable silhouette than a neon diamond. */}
            <g transform="rotate(-24 260 68)">
              <rect x="250" y="64" width="20" height="5" rx="1.5" fill="#b52e43" stroke="#f4c0c7" strokeWidth="1"/>
              <path d="M253 66.5H267" stroke="#fff0f1" strokeWidth="1" strokeLinecap="round"/>
            </g>
          </g>
          </g>
        </g>
        </g>
        <g opacity=".75" stroke={accent.color} strokeOpacity=".42" fill="none">
          <path d="M38 120 V100 H55 M382 120 V100 H365"/><path d="M38 435 V455 H55 M382 435 V455 H365"/>
          <circle cx="44" cy="270" r="3" fill={accent.color}/><circle cx="376" cy="270" r="3" fill={accent.color}/>
        </g>
      </svg>

      <div className="absolute left-3 bottom-3 z-20 max-w-[65%]">
        <p className="font-display text-lg tracking-tight text-slate-100">Kurisu <span style={{ color: accent.color }}>// NK1</span></p>
        <p className="text-[10px] uppercase tracking-[.18em] text-cyan-100/60">2.5D depth preview · {moodLabel[emotion]}{thinking ? " · анализ" : speaking ? " · речь" : ""}</p>
      </div>
      <button type="button" onClick={() => setSettingsOpen((open) => !open)} aria-expanded={settingsOpen} className="absolute right-3 top-[5.5rem] z-30 rounded-md border border-white/15 bg-black/60 px-2.5 py-1.5 text-[10px] font-mono text-white/85 backdrop-blur hover:border-cyan-200/50 md:top-3">
        {settingsOpen ? "Скрыть настройки" : "Настроить образ"}
      </button>
      {settingsOpen ? <div className="absolute inset-x-3 top-20 z-30 max-h-[62%] overflow-y-auto rounded-lg border border-white/15 bg-[#07131b]/95 p-3 text-white shadow-xl backdrop-blur-md md:top-12 md:max-h-[68%]">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div><p className="text-xs font-semibold text-white">Вариант NK1 Original</p><p className="mt-0.5 text-[10px] text-white/55">Настройки сохраняются на этом устройстве.</p></div>
          <button type="button" onClick={() => { setOutfit("lab"); setEyeTone("ice"); setHairTone("copper"); setAccentTone("cyan"); setMotion("soft"); setPoseOverride("auto"); setScale(1); }} className="text-[10px] text-white/60 underline">Сбросить</button>
        </div>
        <div className="space-y-3">
          <section><p className="mb-1.5 text-[10px] uppercase tracking-wider text-white/45">Одежда</p><div className="flex flex-wrap gap-1.5">{OUTFITS.map((item) => <button key={item.id} type="button" aria-pressed={outfit === item.id} onClick={() => setOutfit(item.id)} className={`rounded-md border px-2 py-1.5 text-[10px] ${outfit === item.id ? "border-cyan-200/70 bg-cyan-200/15 text-white" : "border-white/10 text-white/65"}`}>{item.label}</button>)}</div></section>
          <section><p className="mb-1.5 text-[10px] uppercase tracking-wider text-white/45">Глаза</p><div className="flex flex-wrap gap-1.5">{EYES.map((item) => <button key={item.id} type="button" aria-pressed={eyeTone === item.id} onClick={() => setEyeTone(item.id)} className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] ${eyeTone === item.id ? "border-cyan-200/70 bg-cyan-200/15 text-white" : "border-white/10 text-white/65"}`}><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }}/>{item.label}</button>)}</div></section>
          <section><p className="mb-1.5 text-[10px] uppercase tracking-wider text-white/45">Волосы</p><div className="flex flex-wrap gap-1.5">{HAIR.map((item) => <button key={item.id} type="button" aria-pressed={hairTone === item.id} onClick={() => setHairTone(item.id)} className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] ${hairTone === item.id ? "border-cyan-200/70 bg-cyan-200/15 text-white" : "border-white/10 text-white/65"}`}><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.main }}/>{item.label}</button>)}</div></section>
          <section><p className="mb-1.5 text-[10px] uppercase tracking-wider text-white/45">Акцент NK1</p><div className="flex flex-wrap gap-1.5">{ACCENTS.map((item) => <button key={item.id} type="button" aria-pressed={accentTone === item.id} onClick={() => setAccentTone(item.id)} className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] ${accentTone === item.id ? "border-cyan-200/70 bg-cyan-200/15 text-white" : "border-white/10 text-white/65"}`}><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }}/>{item.label}</button>)}</div></section>
          <section><p className="mb-1.5 text-[10px] uppercase tracking-wider text-white/45">Движение</p><div className="flex gap-1.5"><button type="button" aria-pressed={motion === "soft"} onClick={() => setMotion("soft")} className={`rounded-md border px-2 py-1.5 text-[10px] ${motion === "soft" ? "border-cyan-200/70 bg-cyan-200/15" : "border-white/10 text-white/65"}`}>Плавное</button><button type="button" aria-pressed={motion === "expressive"} onClick={() => setMotion("expressive")} className={`rounded-md border px-2 py-1.5 text-[10px] ${motion === "expressive" ? "border-cyan-200/70 bg-cyan-200/15" : "border-white/10 text-white/65"}`}>Выразительное</button></div></section>
          <section><p className="mb-1.5 text-[10px] uppercase tracking-wider text-white/45">Поза</p><div className="flex flex-wrap gap-1.5">{POSES.map((item) => <button key={item.id} type="button" aria-pressed={poseOverride === item.id} onClick={() => setPoseOverride(item.id)} className={`rounded-md border px-2 py-1.5 text-[10px] ${poseOverride === item.id ? "border-cyan-200/70 bg-cyan-200/15" : "border-white/10 text-white/65"}`}>{item.label}</button>)}</div></section>
          <section><label htmlFor="nk-original-scale" className="mb-1.5 flex justify-between text-[10px] uppercase tracking-wider text-white/45"><span>Масштаб персонажа</span><span>{Math.round(scale * 100)}%</span></label><input id="nk-original-scale" type="range" min="0.85" max="1.15" step="0.05" value={scale} onChange={(event) => setScale(Number(event.target.value))} className="w-full accent-cyan-200"/></section>
        </div>
      </div> : null}
    </div>
  );
}
