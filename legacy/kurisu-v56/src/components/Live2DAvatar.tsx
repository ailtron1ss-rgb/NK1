/**
 * Live2D iframe + texture fallback + touch zones + lip pulse while speaking.
 * Never leave a headless / empty stage on mid-range Android WebView.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AvatarExpression } from '../types';

interface Props {
  expression: AvatarExpression;
  isSpeaking: boolean;
  onTap?: () => void;
  onTouchBodyPart?: (part: 'head' | 'face' | 'coat' | 'hand', partLabel: string) => void;
}

const TEXTURE = '/live2d/Kurisu/Kurisu.4096/texture_00.png';

export const Live2DAvatar: React.FC<Props> = ({
  expression,
  isSpeaking,
  onTap,
  onTouchBodyPart
}) => {
  const ref = useRef<HTMLIFrameElement>(null);
  const [mode, setMode] = useState<'loading' | 'live2d' | 'texture'>('loading');
  const [err, setErr] = useState('');
  const [imgOk, setImgOk] = useState(true);
  const lipRef = useRef<number | null>(null);

  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev.data?.type === 'live2d_ready') setMode('live2d');
      if (ev.data?.type === 'live2d_error') {
        setMode('texture');
        setErr(String(ev.data.error || '').slice(0, 100));
      }
    };
    window.addEventListener('message', onMsg);
    const t = setTimeout(() => setMode(m => (m === 'loading' ? 'texture' : m)), 6000);
    return () => {
      window.removeEventListener('message', onMsg);
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    ref.current?.contentWindow?.postMessage(
      { type: 'kurisu_expression', expression: String(expression) },
      '*'
    );
  }, [expression]);

  // Lip-sync approximation: pulse mouth while TTS speaking
  useEffect(() => {
    if (lipRef.current) {
      clearInterval(lipRef.current);
      lipRef.current = null;
    }
    if (isSpeaking) {
      let open = 0;
      lipRef.current = window.setInterval(() => {
        open = open > 0.5 ? 0.1 : 0.65 + Math.random() * 0.25;
        ref.current?.contentWindow?.postMessage(
          { type: 'kurisu_lipsync', value: open },
          '*'
        );
      }, 120);
    } else {
      ref.current?.contentWindow?.postMessage({ type: 'kurisu_lipsync', value: 0 }, '*');
    }
    return () => {
      if (lipRef.current) clearInterval(lipRef.current);
    };
  }, [isSpeaking]);

  const zone = (
    part: 'head' | 'face' | 'coat' | 'hand',
    label: string,
    style: React.CSSProperties
  ) => (
    <button
      type="button"
      aria-label={label}
      className="absolute z-20 bg-transparent border-0 p-0"
      style={style}
      onClick={e => {
        e.stopPropagation();
        onTouchBodyPart?.(part, label);
        ref.current?.contentWindow?.postMessage(
          { type: 'motion', group: part === 'head' || part === 'face' ? 'TapHead' : 'TapBody' },
          '*'
        );
      }}
    />
  );

  return (
    <div
      className="relative w-full h-full min-h-[320px] rounded-xl overflow-hidden bg-gradient-to-b from-[#1a1520] to-[#0a080c]"
      onClick={() => {
        ref.current?.contentWindow?.postMessage({ type: 'tap' }, '*');
        onTap?.();
      }}
    >
      {/* Texture always under Live2D — full character visible if runtime fails */}
      {imgOk && (
        <img
          src={TEXTURE}
          alt="Kurisu"
          className="absolute inset-0 w-full h-full object-contain object-bottom pointer-events-none select-none"
          style={{
            zIndex: mode === 'live2d' ? 0 : 1,
            opacity: mode === 'live2d' ? 0 : 1,
            transition: 'opacity 0.4s'
          }}
          onError={() => setImgOk(false)}
          draggable={false}
        />
      )}
      {!imgOk && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 text-xs font-mono p-4 z-[1]">
          <div className="text-4xl mb-2">🔬</div>
          <div>Курису (текстура не загрузилась)</div>
          <div className="text-white/40 mt-1">Проверь public/live2d/Kurisu/Kurisu.4096/</div>
        </div>
      )}

      <iframe
        ref={ref}
        title="Kurisu Live2D"
        src="/live2d/viewer.html"
        className="absolute inset-0 w-full h-full border-0"
        style={{
          zIndex: 2,
          opacity: mode === 'live2d' ? 1 : 0,
          pointerEvents: mode === 'live2d' ? 'auto' : 'none',
          background: 'transparent'
        }}
        allow="autoplay"
      />

      {/* Speaking indicator */}
      {isSpeaking && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 flex gap-1">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1.5 h-3 bg-[#FF3B30] rounded-full animate-pulse"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      )}

      {/* Touch zones (work even in texture mode) */}
      {zone('head', 'Голова / Волосы', { left: '30%', top: '4%', width: '40%', height: '18%' })}
      {zone('face', 'Лицо / Щека', { left: '32%', top: '18%', width: '36%', height: '16%' })}
      {zone('coat', 'Халат', { left: '28%', top: '38%', width: '44%', height: '32%' })}
      {zone('hand', 'Рука', { left: '8%', top: '48%', width: '20%', height: '22%' })}

      <div className="absolute bottom-2 right-2 text-[9px] font-mono text-white/60 bg-black/55 px-2 py-1 rounded z-30">
        {mode === 'live2d' ? 'LIVE2D' : mode === 'loading' ? 'LOADING…' : 'TEXTURE'}
        {isSpeaking ? ' · 👄' : ''}
        {err ? ` · ${err.slice(0, 40)}` : ''}
      </div>
    </div>
  );
};
