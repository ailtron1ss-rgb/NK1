import React, { useEffect, useState } from 'react';
import { multiLayerConsciousness } from '../cognitive/MultiLayerConsciousness';
import { attentionEconomy } from '../brain/attentionEconomy';
import { emotionAffect } from '../psyche/EmotionAffectSystem';
import { getLabShift } from '../brain/labClock';
import { unifiedConsciousness } from '../cognitive/UnifiedConsciousness';

export const ConsciousnessHUD: React.FC = () => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const hud = multiLayerConsciousness.hud();
  const attn = attentionEconomy.get();
  const affect = emotionAffect.get();
  const dom = emotionAffect.dominantEmotion(affect);
  const shift = getLabShift();
  const uLine = unifiedConsciousness.hudLine();
  void tick;

  const readinessColor =
    hud.readiness === 'silent'
      ? '#FF3B30'
      : hud.readiness === 'short'
        ? '#FFB020'
        : hud.readiness === 'rich'
          ? '#00FF94'
          : '#5AC8FA';

  const pulse =
    dom === 'anger' ? 'rgba(255,59,48,0.35)' : dom === 'joy' ? 'rgba(0,255,148,0.3)' : 'rgba(90,200,250,0.2)';

  return (
    <div className="consciousness-hud pointer-events-none select-none">
      <div className="chud-top">
        <span className="chud-pill" style={{ borderColor: readinessColor, color: readinessColor }}>
          {hud.readiness.toUpperCase()}
        </span>
        <span
          className="chud-pill"
          style={{
            borderColor: pulse,
            color: '#fff',
            boxShadow: `0 0 12px ${pulse}`,
            animation: 'kurisuPulse 2.2s ease-in-out infinite'
          }}
        >
          FEEL {dom}
        </span>
        <span className="chud-pill">COH {Math.round(hud.coherence)}</span>
        <span className="chud-pill">
          ATN {attn.tokens}/{attn.maxTokens}
        </span>
        <span className="chud-pill">SHIFT {shift}</span>
      </div>
      <div className="chud-bars">
        {[
          { n: 'joy', v: affect.emotions.joy, c: '#00FF94' },
          { n: 'ang', v: affect.emotions.anger, c: '#FF3B30' },
          { n: 'tru', v: affect.emotions.trustFeel, c: '#5AC8FA' },
          { n: 'att', v: affect.feelings.attachment, c: '#FF6BCB' },
          { n: 'lon', v: affect.feelings.loneliness, c: '#8B8B9E' },
          { n: 'hun', v: affect.feelings.intellectualHunger, c: '#A78BFA' },
          { n: 'sad', v: affect.emotions.sadness, c: '#60A5FA' },
          { n: 'fea', v: affect.emotions.fear, c: '#C084FC' }
        ].map(l => (
          <div key={l.n} className="chud-bar-row" title={l.n}>
            <span className="chud-bar-label">{l.n.toUpperCase()}</span>
            <div className="chud-bar-track">
              <div
                className="chud-bar-fill"
                style={{
                  width: `${Math.min(100, Math.max(4, l.v))}%`,
                  background: l.c
                }}
              />
            </div>
          </div>
        ))}
        {hud.layers.slice(0, 4).map(l => (
          <div key={l.name} className="chud-bar-row" title={l.name}>
            <span className="chud-bar-label">{l.name.slice(0, 3).toUpperCase()}</span>
            <div className="chud-bar-track">
              <div className="chud-bar-fill" style={{ width: `${Math.min(100, Math.max(4, l.score))}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="chud-workspace text-[9px] opacity-80">{uLine}</div>
      <style>{`@keyframes kurisuPulse{0%,100%{opacity:1}50%{opacity:0.72}}`}</style>
    </div>
  );
};
