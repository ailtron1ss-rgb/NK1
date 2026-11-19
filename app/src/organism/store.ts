import { create } from "zustand";
import type { OrganismSnapshot } from "./types";
import { emptySnapshot } from "./types";
import { neuroApi } from "@/neuro-kurisu/api";
import { toOrganismSnapshot } from "@/neuro-kurisu/normalize";

type Tab = "mind" | "memory" | "lab" | "skills" | "evidence";
const CHAT_KEY = "neuro-kurisu-chat-v2";
let lastInitiativePollAt = 0;

function loadChat(): OrganismSnapshot["chat"] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(CHAT_KEY) || "[]");
    return Array.isArray(raw) ? raw.slice(-120) : [];
  } catch { return []; }
}
function saveChat(chat: OrganismSnapshot["chat"]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(CHAT_KEY, JSON.stringify(chat.slice(-120))); } catch { /* quota-safe UI cache */ }
}

interface KurisuStore {
  snap: OrganismSnapshot;
  busy: boolean;
  tab: Tab;
  error: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  send: (text: string) => Promise<void>;
  sleep: () => Promise<void>;
  wake: () => Promise<void>;
  reset: () => void;
  setTab: (tab: Tab) => void;
  tickIdle: () => Promise<void>;
}

export const useKurisu = create<KurisuStore>((set, get) => ({
  snap: emptySnapshot(),
  busy: false,
  tab: "mind",
  error: null,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    set({ hydrated: true, error: null });
    try {
      const remote = await neuroApi.uiSnapshot();
      set({ snap: toOrganismSnapshot(remote, loadChat()), error: null });
    } catch (error) {
      set({ snap: { ...emptySnapshot(), chat: loadChat() }, error: error instanceof Error ? error.message : String(error) });
    }
  },

  refresh: async () => {
    try {
      const remote = await neuroApi.uiSnapshot();
      set({ snap: toOrganismSnapshot(remote, get().snap.chat), error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  setTab: (tab) => set({ tab }),

  sleep: async () => {
    try {
      await neuroApi.sleep();
      await get().refresh();
    } catch (error) { set({ error: error instanceof Error ? error.message : String(error) }); }
  },

  wake: async () => {
    try {
      await neuroApi.wake();
      await get().refresh();
    } catch (error) { set({ error: error instanceof Error ? error.message : String(error) }); }
  },

  reset: () => {
    const chat: OrganismSnapshot["chat"] = [];
    saveChat(chat);
    set({ snap: { ...get().snap, chat }, error: null });
  },

  tickIdle: async () => {
    if (get().busy || !get().hydrated) return;
    try {
      const remote = await neuroApi.uiSnapshot();
      set({ snap: toOrganismSnapshot(remote, get().snap.chat), error: null });
      const now = Date.now();
      if (now - lastInitiativePollAt < 5_000) return;
      lastInitiativePollAt = now;
      const pending = await neuroApi.proactiveMessage();
      const initiative = pending.initiative;
      if (!initiative?.id || !initiative.message?.trim()) return;
      const existing = get().snap.chat;
      const turnId = `ui-initiative-${initiative.id}`;
      const chat = existing.some(turn => turn.id === turnId)
        ? existing
        : [...existing, {
            id: turnId,
            role: "kurisu" as const,
            text: initiative.message.trim(),
            at: Number(initiative.createdAt || now),
            tick: Number(get().snap.tick || 0),
            option: "reflect" as const,
            backend: `autonomous-initiative:${initiative.kind}`,
          }].slice(-120);
      if (chat !== existing) {
        saveChat(chat);
        set({ snap: { ...get().snap, chat } });
      }
      // ACK only after the message is safely in the browser's durable chat cache.
      // If ACK fails, the stable turn id makes the next poll idempotent.
      await neuroApi.ackProactiveMessage(initiative.id).catch(() => null);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  send: async (text) => {
    const trimmed = text.trim();
    if (!trimmed || get().busy) return;
    const userTurn = { id: `ui-user-${Date.now()}`, role: "user" as const, text: trimmed, at: Date.now(), tick: get().snap.tick };
    set({ busy: true, error: null, snap: { ...get().snap, chat: [...get().snap.chat, userTurn] } });
    try {
      const result = await neuroApi.chat(trimmed, true, false);
      const reply = String(result.language?.text || "Я обработала запрос, но язык временно недоступен.");
      // The reply can change the organism's appraisal. Read the post-response
      // snapshot before binding an emotion to the chat turn, so AvatarStage and
      // browser TTS don't inherit the pre-response emotion by accident.
      let refreshedSnapshot: OrganismSnapshot = get().snap;
      let refreshError: string | null = null;
      try {
        const remote = await neuroApi.uiSnapshot();
        refreshedSnapshot = toOrganismSnapshot(remote, get().snap.chat);
      } catch (error) {
        // Preserve the reply and durable chat if the snapshot endpoint is temporarily unavailable.
        refreshError = error instanceof Error ? error.message : String(error);
      }
      const responseAt = Date.now();
      const kurisuTurn = {
        id: `ui-kurisu-${responseAt}`,
        role: "kurisu" as const,
        text: reply,
        at: responseAt,
        tick: Number(result.cycle?.state?.tick ?? refreshedSnapshot.tick),
        emotion: refreshedSnapshot.emotion.label,
        option: (String(result.cycle?.decision?.selected?.action || result.worldAction || refreshedSnapshot.lastOption) as OrganismSnapshot["lastOption"]),
        backend: String(result.language?.backend || "canonical"),
      };
      const chat = [...get().snap.chat, kurisuTurn].slice(-120);
      saveChat(chat);
      set({ snap: { ...refreshedSnapshot, chat }, busy: false, error: refreshError });
    } catch (error) {
      const chat = get().snap.chat;
      saveChat(chat);
      set({ busy: false, error: error instanceof Error ? error.message : String(error) });
    }
  },
}));
