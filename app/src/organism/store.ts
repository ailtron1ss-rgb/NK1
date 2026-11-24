import { create } from "zustand";
import type { OrganismSnapshot } from "./types";
import { emptySnapshot } from "./types";
import { neuroApi } from "@/neuro-kurisu/api";
import { toOrganismSnapshot } from "@/neuro-kurisu/normalize";
import { readAvatarPreference, writeAvatarPreference } from "@/legacy/avatar/safeLocalStorage";
import { shouldApplyUiSnapshot, type UiSnapshotStamp } from "./snapshotSync";

export type LabsTab = "mind" | "memory" | "lab" | "skills" | "evidence";
export type AppSection = "home" | "memory" | "motivation" | "settings" | "more";
export type AvatarViewMode = "live2d" | "legacy" | "original" | "3d";
export type UiConnectionStatus = "connecting" | "connected" | "degraded" | "disconnected";

export interface UiConnectionState {
  status: UiConnectionStatus;
  version: string | null;
  schemaVersion: number | null;
  tick: number | null;
  at: number | null;
  lastSyncedAt: number | null;
  lastError: string | null;
  serviceDegraded: boolean;
  stamp: UiSnapshotStamp | null;
}

const CHAT_KEY = "neuro-kurisu-chat-v2";
let lastInitiativePollAt = 0;
let latestSnapshotRequestId = 0;
let chatSequence = 0;

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
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
function readAvatarMode(): AvatarViewMode {
  const value = readAvatarPreference("kurisu-avatar-mode");
  return value === "legacy" || value === "original" || value === "3d" ? value : "live2d";
}
const initialConnection: UiConnectionState = {
  status: "connecting",
  version: null,
  schemaVersion: null,
  tick: null,
  at: null,
  lastSyncedAt: null,
  lastError: null,
  serviceDegraded: false,
  stamp: null,
};

interface KurisuStore {
  snap: OrganismSnapshot;
  busy: boolean;
  tab: LabsTab;
  section: AppSection;
  error: string | null;
  hydrated: boolean;
  connection: UiConnectionState;
  avatarMode: AvatarViewMode;
  voiceEnabled: boolean;
  voiceName: string;
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  send: (text: string) => Promise<boolean>;
  sleep: () => Promise<void>;
  wake: () => Promise<void>;
  reset: () => void;
  setTab: (tab: LabsTab) => void;
  setSection: (section: AppSection) => void;
  setAvatarMode: (mode: AvatarViewMode) => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setVoiceName: (name: string) => void;
  tickIdle: () => Promise<void>;
}

export const useKurisu = create<KurisuStore>((set, get) => {
  const pullCanonicalSnapshot = async (useCachedChat = false): Promise<boolean> => {
    const requestId = ++latestSnapshotRequestId;
    try {
      const remote = await neuroApi.uiSnapshot();
      const current = get();
      const stamp: UiSnapshotStamp = {
        version: remote.version,
        schemaVersion: remote.schemaVersion,
        tick: remote.tick,
        at: remote.at,
      };
      if (!shouldApplyUiSnapshot(stamp, current.connection.stamp, requestId, latestSnapshotRequestId)) return false;

      const chat = useCachedChat ? loadChat() : current.snap.chat;
      const nextSnapshot = toOrganismSnapshot(remote, chat);
      const languageDegraded = remote.language?.degraded === true;
      set({
        snap: nextSnapshot,
        connection: {
          status: "connected",
          version: remote.version,
          schemaVersion: remote.schemaVersion,
          tick: remote.tick,
          at: remote.at,
          lastSyncedAt: Date.now(),
          lastError: null,
          serviceDegraded: languageDegraded,
          stamp,
        },
        error: null,
      });
      return true;
    } catch (error) {
      if (requestId !== latestSnapshotRequestId) return false;
      const message = errorMessage(error);
      const current = get().connection;
      set({
        connection: {
          ...current,
          status: current.lastSyncedAt === null ? "disconnected" : "degraded",
          lastError: message,
        },
        error: message,
      });
      return false;
    }
  };

  return {
    snap: emptySnapshot(),
    busy: false,
    tab: "mind",
    section: "home",
    error: null,
    hydrated: false,
    connection: initialConnection,
    avatarMode: readAvatarMode(),
    voiceEnabled: readAvatarPreference("kurisu-avatar-voice-enabled") === "true",
    voiceName: readAvatarPreference("kurisu-avatar-voice-name") ?? "",

    hydrate: async () => {
      if (get().hydrated) return;
      set({ hydrated: true, error: null, connection: { ...get().connection, status: "connecting", lastError: null } });
      await pullCanonicalSnapshot(true);
    },

    refresh: async () => {
      await pullCanonicalSnapshot(false);
    },

    setTab: (tab) => set({ tab }),
    setSection: (section) => set({ section }),

    setAvatarMode: (avatarMode) => {
      writeAvatarPreference("kurisu-avatar-mode", avatarMode);
      set({ avatarMode });
    },
    setVoiceEnabled: (voiceEnabled) => {
      writeAvatarPreference("kurisu-avatar-voice-enabled", String(voiceEnabled));
      set({ voiceEnabled });
    },
    setVoiceName: (voiceName) => {
      writeAvatarPreference("kurisu-avatar-voice-name", voiceName);
      set({ voiceName });
    },

    sleep: async () => {
      try {
        await neuroApi.sleep();
        await get().refresh();
      } catch (error) { set({ error: errorMessage(error) }); }
    },

    wake: async () => {
      try {
        await neuroApi.wake();
        await get().refresh();
      } catch (error) { set({ error: errorMessage(error) }); }
    },

    reset: () => {
      const chat: OrganismSnapshot["chat"] = [];
      saveChat(chat);
      set({ snap: { ...get().snap, chat }, error: null });
    },

    tickIdle: async () => {
      if (get().busy || !get().hydrated) return;
      const synced = await pullCanonicalSnapshot(false);
      if (!synced || get().connection.status === "disconnected") return;

      const now = Date.now();
      if (now - lastInitiativePollAt < 5_000) return;
      lastInitiativePollAt = now;
      try {
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
        set({ error: errorMessage(error) });
      }
    },

    send: async (text) => {
      const trimmed = text.trim();
      if (!trimmed || get().busy) return false;
      const now = Date.now();
      const userTurn = {
        id: `ui-user-${now}-${++chatSequence}`,
        role: "user" as const,
        text: trimmed,
        at: now,
        tick: get().snap.tick,
      };
      const optimisticChat = [...get().snap.chat, userTurn].slice(-120);
      saveChat(optimisticChat);
      set({ busy: true, error: null, snap: { ...get().snap, chat: optimisticChat } });
      try {
        const result = await neuroApi.chat(trimmed, true, false);
        const reply = String(result.language?.text || "Я обработала запрос, но язык временно недоступен.");
        // The message response may change appraisal. Refresh the canonical snapshot
        // before binding the reply's visible emotion to the conversation turn.
        await pullCanonicalSnapshot(false);
        const current = get();
        const responseAt = Date.now();
        const kurisuTurn = {
          id: `ui-kurisu-${responseAt}-${++chatSequence}`,
          role: "kurisu" as const,
          text: reply,
          at: responseAt,
          tick: Number(result.cycle?.state?.tick ?? current.snap.tick),
          emotion: current.snap.emotion.label,
          option: (String(result.cycle?.decision?.selected?.action || result.worldAction || current.snap.lastOption) as OrganismSnapshot["lastOption"]),
          backend: String(result.language?.backend || "canonical"),
        };
        const chat = [...current.snap.chat, kurisuTurn].slice(-120);
        saveChat(chat);
        set({ snap: { ...current.snap, chat }, busy: false });
        return true;
      } catch (error) {
        const message = errorMessage(error);
        const current = get();
        saveChat(current.snap.chat);
        set({ busy: false, error: message });
        return false;
      }
    },
  };
});
