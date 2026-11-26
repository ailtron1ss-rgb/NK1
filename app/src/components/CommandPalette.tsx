import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Brain, Command, Home, Moon, Search, Settings, HeartPulse, Sun, Wrench, X } from "lucide-react";
import { useKurisu, type AppSection } from "@/organism/store";
import { filterUiCommands, nextUiCommandIndex, type UiCommandDescriptor } from "@/organism/commandPalette";

interface PaletteCommand extends UiCommandDescriptor {
  detail: string;
  disabled?: boolean;
  icon: typeof Home;
  run: () => void;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const setSection = useKurisu((s) => s.setSection);
  const setTab = useKurisu((s) => s.setTab);
  const refresh = useKurisu((s) => s.refresh);
  const sleep = useKurisu((s) => s.sleep);
  const wake = useKurisu((s) => s.wake);
  const awake = useKurisu((s) => s.snap.awake);
  const connected = useKurisu((s) => s.connection.status === "connected");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setOpen(true);
        setQuery("");
        setActiveIndex(0);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) input.current?.focus();
    else opener.current?.focus();
  }, [open]);

  const navigate = useCallback((section: AppSection) => {
    setSection(section);
    if (section === "memory") setTab("memory");
    if (section === "more") setTab("mind");
  }, [setSection, setTab]);

  const commands = useMemo<PaletteCommand[]>(() => [
    { id: "home", title: "Open Home", detail: "Avatar, conversation and live HUD", keywords: ["avatar", "chat", "main", "главная"], icon: Home, run: () => navigate("home") },
    { id: "memory", title: "Open Memory", detail: "Search canonical MemoryOS2 records", keywords: ["recall", "facts", "search", "память"], icon: Brain, run: () => navigate("memory") },
    { id: "motivation", title: "Open Motivation", detail: "Goals and homeostatic drives", keywords: ["goals", "needs", "drives", "цели"], icon: HeartPulse, run: () => navigate("motivation") },
    { id: "settings", title: "Open Settings", detail: "Voice and avatar preferences", keywords: ["voice", "avatar", "preferences", "настройки"], icon: Settings, run: () => navigate("settings") },
    { id: "more", title: "Open Diagnostics", detail: "Runtime health, recovery and operator tools", keywords: ["health", "status", "tools", "recovery", "диагностика"], icon: Wrench, run: () => navigate("more") },
    { id: "refresh", title: "Refresh canonical state", detail: "Fetch the latest authoritative UI snapshot", keywords: ["sync", "runtime", "reconnect", "обновить"], icon: Activity, disabled: !connected, run: () => { void refresh(); } },
    { id: "sleep", title: "Put organism to sleep", detail: "Request the canonical sleep transition", keywords: ["rest", "pause", "сон"], icon: Moon, disabled: !connected || !awake, run: () => { void sleep(); } },
    { id: "wake", title: "Wake organism", detail: "Request the canonical wake transition", keywords: ["resume", "awake", "проснуться"], icon: Sun, disabled: !connected || awake, run: () => { void wake(); } },
  ], [connected, awake, navigate, refresh, sleep, wake]);

  const visible = useMemo(() => filterUiCommands(commands, query), [commands, query]);

  useEffect(() => {
    const firstEnabled = visible.findIndex((command) => !command.disabled);
    setActiveIndex(firstEnabled >= 0 ? firstEnabled : 0);
  }, [visible]);

  const closePalette = () => setOpen(false);
  const runActiveCommand = () => {
    const command = visible[activeIndex];
    if (!command || command.disabled) return;
    command.run();
    closePalette();
  };
  const moveActive = (direction: 1 | -1) => {
    setActiveIndex((currentIndex) => {
      const next = nextUiCommandIndex(visible, currentIndex, direction);
      return next >= 0 ? next : currentIndex;
    });
  };

  if (!open) {
    return (
      <button type="button" onClick={() => {
        opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setOpen(true);
        setQuery("");
        setActiveIndex(0);
      }} className="fixed right-3 top-20 z-40 flex items-center gap-2 rounded-full border border-border bg-surface/90 px-3 py-2 text-[10px] text-muted shadow-lg backdrop-blur" aria-label="Open command palette">
        <Command className="size-3.5" /> Quick commands <kbd className="rounded border border-border px-1.5 py-0.5">Ctrl K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center bg-black/60 px-3 pt-[12vh] backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closePalette(); }}>
      <section role="dialog" aria-modal="true" aria-label="Quick command palette" className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 shrink-0 text-muted" />
          <input
            ref={input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") { event.preventDefault(); moveActive(1); }
              else if (event.key === "ArrowUp") { event.preventDefault(); moveActive(-1); }
              else if (event.key === "Enter") { event.preventDefault(); runActiveCommand(); }
            }}
            placeholder="Search pages and actions…"
            aria-label="Search commands"
            aria-controls="kurisu-command-list"
            aria-activedescendant={visible[activeIndex] ? "kurisu-command-" + visible[activeIndex].id : undefined}
            className="h-12 min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
          />
          <button type="button" onClick={closePalette} aria-label="Close command palette" className="rounded p-1.5 text-muted hover:text-fg"><X className="size-4" /></button>
        </div>
        <div id="kurisu-command-list" role="listbox" aria-label="Available commands" className="max-h-[60vh] overflow-y-auto p-2">
          {visible.length ? visible.map((command, index) => {
            const Icon = command.icon;
            const active = index === activeIndex;
            return (
              <button
                key={command.id}
                id={"kurisu-command-" + command.id}
                type="button"
                role="option"
                aria-selected={active}
                disabled={command.disabled}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => { command.run(); closePalette(); }}
                className={"flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40 " + (active ? "bg-elevated" : "hover:bg-elevated")}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-elevated text-accent"><Icon className="size-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-fg">{command.title}</span><span className="mt-0.5 block text-xs text-muted">{command.detail}</span></span>
                {command.disabled ? <span className="text-[9px] text-subtle">Unavailable</span> : null}
              </button>
            );
          }) : <p className="px-3 py-6 text-center text-sm text-muted">No matching commands.</p>}
        </div>
        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[10px] text-subtle"><span>Keyboard shortcut</span><span>Ctrl / ⌘ + K · Esc to close</span></div>
      </section>
    </div>
  );
}
