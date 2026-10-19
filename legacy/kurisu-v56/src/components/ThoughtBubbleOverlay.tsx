/**
 * Floating thought / desire bubbles from PresenceAndIdle.
 * Shows above the avatar area so she feels alive even when silent.
 */
import React from 'react';
import { ThoughtBubble } from '../cognitive/PresenceAndIdle';

interface Props {
  bubbles: ThoughtBubble[];
}

const kindIcon: Record<ThoughtBubble['kind'], string> = {
  thought: '💭',
  desire: '✨',
  intention: '🎯',
  observation: '👁',
  self_check: '🔍'
};

export const ThoughtBubbleOverlay: React.FC<Props> = ({ bubbles }) => {
  if (!bubbles.length) return null;

  return (
    <div className="pointer-events-none absolute top-2 left-2 right-2 z-20 flex flex-col gap-1.5 items-start max-w-[90%]">
      {bubbles.slice(0, 2).map((b) => (
        <div
          key={b.id}
          className="animate-in fade-in slide-in-from-top-2 duration-300 px-3 py-2 rounded-2xl rounded-bl-sm bg-black/70 backdrop-blur-md border border-white/15 text-[12px] text-white/90 shadow-lg max-w-[280px]"
          style={{ opacity: 0.55 + b.intensity * 0.45 }}
        >
          <span className="mr-1.5">{kindIcon[b.kind] || '💭'}</span>
          <span className="font-medium leading-snug">{b.text}</span>
        </div>
      ))}
    </div>
  );
};
