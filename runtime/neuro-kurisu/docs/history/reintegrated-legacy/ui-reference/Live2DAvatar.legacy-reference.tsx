/**
 * Live2D iframe + real 2D canvas fallback + touch + expression/motion bridge.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AvatarExpression, AvatarSettings } from '../types';
import { Avatar2D } from './Avatar2D';
import { embodimentBus } from '../services/embodimentBus';
import { runtimeGovernor } from '../services/runtimeGovernor';

export type AvatarBodyPart = 'head' | 'face' | 'coat' | 'hand';

interface Props {
  expression: AvatarExpression;
  isSpeaking: boolean;
  onTap?: () => void;
  onTouchBodyPart?: (part: AvatarBodyPart, partLabel: string) => void;
  floatingReaction?: string | null;
}

const VIEWER = '/live2d/viewer.html';

export const Live2DAvatar: React.FC<Props> = ({
  expression, isSpeaking, onTap, onTouchBodyPart, floatingReaction
}) => {
  const ref = useRef<HTMLIFrameElement>(null);
  const [mode, setMode] = useState<'loading' | 'live2d' | 'safe'>('loading');
  const [err, setErr] = useState('');
  const lipRef = useRef<number | null>(null);

  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev.data?.type === 'live2d_ready') setMode('live2d');
      if (ev.data?.type === 'live2d_error') {
        setMode('safe');
        setErr(String(ev.data.error || '').slice(0, 120));
      }
    };
    window.addEventListener('message', onMsg);
    const t = setTimeout(() => setMode(m => (m === 'loading' ? 'safe' : m)), 8000);
    return () => {
      window.removeEventListener('message', onMsg);
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    ref.current?.contentWindow?.postMessage({ type: 'kurisu_expression', expression: String(expression) }, window.location.origin);
  }, [expression]);

  useEffect(() => {
    const unsubscribe = embodimentBus.subscribe(signal => {
      try {
        ref.current?.contentWindow?.postMessage({
          type: 'kurisu_embodiment',
          emotion: signal.emotion,
          gesture: signal.gesture,
          gesturePhase: signal.gesturePhase,
          speaking: signal.speaking,
          breath: signal.breath,
          gazeX: signal.gazeX,
          gazeY: signal.gazeY,
          headTilt: signal.headTilt,
          mouthOpen: signal.mouthOpen,
          expressionIntensity: signal.expressionIntensity,
          voicePitch: signal.voicePitch,
          voiceRate: signal.voiceRate,
          voiceEmphasis: signal.voiceEmphasis,
          expressionContext: signal.expressionContext
        }, window.location.origin);
      } catch { /* iframe may not be ready */ }
    });
    return () => { unsubscribe(); };
  }, []);

  // Idle motion is driven only by a real embodied signal. The avatar never invents a new 'life event' on a timer.
  useEffect(() => {
    const unsubscribe = embodimentBus.subscribe(signal => {
      if (!signal) return;
      if (signal.gesture || signal.preSpeech || signal.breath) {
        try { ref.current?.contentWindow?.postMessage({ type: 'motion', group: signal.motionGroup || 'Idle' }, window.location.origin); } catch {}
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (lipRef.current) { clearInterval(lipRef.current); lipRef.current = null; }
    if (isSpeaking) {
      let open = 0;
      lipRef.current = window.setInterval(() => {
        open = open > 0.5 ? 0.1 : 0.65 + Math.random() * 0.25;
        ref.current?.contentWindow?.postMessage({ type: 'kurisu_lipsync', value: open }, window.location.origin);
      }, 120);
    } else {
      ref.current?.contentWindow?.postMessage({ type: 'kurisu_lipsync', value: 0 }, window.location.origin);
    }
    return () => { if (lipRef.current) clearInterval(lipRef.current); };
  }, [isSpeaking]);

  const zone = (part: AvatarBodyPart, label: string, style: React.CSSProperties) => (
    <button type="button" aria-label={label} className="absolute z-30 bg-transparent border-0 p-0" style={style}
      onClick={e => { e.stopPropagation(); e.preventDefault(); onTouchBodyPart?.(part, label); ref.current?.contentWindow?.postMessage({ type: 'tap' }, window.location.origin); }} />
  );

  return (
    <div className="relative w-full h-full min-h-[280px] rounded-xl overflow-hidden bg-[#05080c]"
      onClick={e => { e.stopPropagation(); ref.current?.contentWindow?.postMessage({ type: 'tap' }, window.location.origin); onTap?.(); }}>
      <iframe ref={ref} title="Курису Live2D" src={VIEWER}
        className="absolute inset-0 w-full h-full border-0 z-10 bg-transparent"
        style={{ opacity: mode === 'live2d' ? 1 : 0 }} allow="autoplay" />
      {mode === 'loading' && (
        <div className="absolute inset-0 z-20 matrix-stage flex items-center justify-center">
          <div className="text-[10px] font-mono text-[#00ff94]/60">инициализация Live2D…</div>
        </div>
      )}
      {mode === 'safe' && (
        <div className="absolute inset-0 z-20">
          <Avatar2D
            expression={expression}
            isSpeaking={isSpeaking}
            avatarSettings={{
              outfit: 'lab_coat', glasses: 'red_frame', hairstyle: 'classic_twintails',
              background: 'lab', lodQuality: 'medium', lipSyncEnabled: true, eyeTrackingEnabled: true
            } as AvatarSettings}
            onAvatarClick={onTap}
            onTouchBodyPart={(part, label) => onTouchBodyPart?.(part, label)}
          />
          {err && (
            <div className="absolute left-2 right-2 top-2 z-40 text-[9px] font-mono text-amber-200/60 pointer-events-none truncate">Live2D недоступен: {err}</div>
          )}
        </div>
      )}
      {zone('head', 'голова', { left: '32%', top: '4%', width: '36%', height: '14%' })}
      {zone('face', 'лицо', { left: '34%', top: '16%', width: '32%', height: '18%' })}
      {zone('coat', 'халат', { left: '28%', top: '38%', width: '44%', height: '36%' })}
      {zone('hand', 'рука', { left: '12%', top: '48%', width: '16%', height: '22%' })}
      {zone('hand', 'рука', { left: '72%', top: '48%', width: '16%', height: '22%' })}
      {floatingReaction ? (
        <div className="absolute right-2 top-3 z-40 max-w-[70%] pointer-events-none">
          <div className="bg-black/75 border border-[#00ff6a44] text-[#e8ffe8] text-[11px] leading-snug rounded-2xl rounded-tr-sm px-3 py-2 shadow-lg backdrop-blur-sm">
            {floatingReaction}
          </div>
        </div>
      ) : null}
      <div className="absolute left-2 bottom-2 z-30 text-[9px] font-mono text-white/35">
        {mode === 'live2d' ? 'Live2D' : mode === 'loading' ? 'загрузка…' : '2D-рендер'}
      </div>
    </div>
  );
};
