

/** Map internal emotion to pitch/rate multipliers for Web Speech API */
export function applyEmotionToVoice(
  base: { pitch: number; speed: number },
  emotions: { irritation?: number; affection?: number; curiosity?: number; happiness?: number }
) {
  let pitch = base.pitch;
  let speed = base.speed;
  const irr = emotions.irritation ?? 0;
  const aff = emotions.affection ?? 0;
  const cur = emotions.curiosity ?? 0;
  if (irr > 60) { pitch -= 0.05; speed += 0.08; }
  if (aff > 65) { pitch += 0.06; speed -= 0.05; }
  if (cur > 70) { pitch += 0.03; speed += 0.04; }
  return {
    pitch: Math.max(0.6, Math.min(1.4, pitch)),
    speed: Math.max(0.7, Math.min(1.3, speed))
  };
}
