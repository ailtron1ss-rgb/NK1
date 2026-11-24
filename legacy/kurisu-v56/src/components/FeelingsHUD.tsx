import React, { useEffect, useState } from 'react';
import { emotionAffect } from '../psyche/EmotionAffectSystem';
import { unifiedConsciousness } from '../cognitive/UnifiedConsciousness';
import { relationshipModel } from '../cognitive/RelationshipModel';

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-1.5 text-[9px] font-mono">
      <span className="w-10 text-white/50 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-white/10 rounded overflow-hidden">
        <div className="h-full rounded transition-all duration-500" style={{ width: `${v}%`, background: color }} />
      </div>
      <span className="w-6 text-right text-white/40">{Math.round(v)}</span>
    </div>
  );
}

export const FeelingsHUD: React.FC = () => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 900);
    return () => clearInterval(id);
  }, []);

  const s = emotionAffect.get();
  const dom = emotionAffect.dominantEmotion(s);
  const hud = unifiedConsciousness.hudLine();
  const rel = relationshipModel.summaryForPrompt();

  return (
    <div className="feelings-hud rounded-xl border border-white/10 bg-black/50 backdrop-blur-md p-2 space-y-1.5 pointer-events-none">
      <div className="flex flex-wrap gap-1 items-center">
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#FF3B30]/40 text-[#FF3B30]">
          DOM {dom}
        </span>
        <span className="text-[9px] font-mono text-white/45">{hud}</span>
      </div>
      <Bar label="joy" value={s.emotions.joy} color="#00FF94" />
      <Bar label="anger" value={s.emotions.anger} color="#FF3B30" />
      <Bar label="trust" value={s.emotions.trustFeel} color="#5AC8FA" />
      <Bar label="anticip" value={s.emotions.anticipation} color="#FF9F0A" />
      <Bar label="sad" value={s.emotions.sadness} color="#60A5FA" />
      <Bar label="fear" value={s.emotions.fear} color="#C084FC" />
      <Bar label="surprise" value={s.emotions.surprise} color="#F472B6" />
      <Bar label="attach" value={s.feelings.attachment} color="#FF6BCB" />
      <Bar label="lonely" value={s.feelings.loneliness} color="#8B8B9E" />
      <Bar label="hunger" value={s.feelings.intellectualHunger} color="#A78BFA" />
      <Bar label="safety" value={s.feelings.safety} color="#34D399" />
      <Bar label="fatigue" value={s.feelings.fatigueFeel} color="#FBBF24" />
      <div className="text-[8px] text-white/35 font-mono truncate pt-0.5">{rel}</div>
    </div>
  );
};
