/**
 * Single bus for body signals so avatar / TTS / HUD stay aligned.
 */

export type EmbodimentEvent = {
  emotion?: string;
  speaking?: boolean;
  gesture?: string;
  touchZone?: string;
  breath?: string;
};

type Handler = (e: EmbodimentEvent) => void;

class EmbodimentBus {
  private handlers = new Set<Handler>();
  private last: EmbodimentEvent = {};

  subscribe(h: Handler) {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }

  emit(partial: EmbodimentEvent) {
    this.last = { ...this.last, ...partial };
    for (const h of this.handlers) {
      try {
        h(this.last);
      } catch {
        /* */
      }
    }
    try {
      (window as any).__kurisuEmbodiment = this.last;
    } catch {
      /* */
    }
  }

  get() {
    return this.last;
  }
}

export const embodimentBus = new EmbodimentBus();
