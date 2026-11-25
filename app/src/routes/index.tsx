import { useEffect, useLayoutEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AvatarStage } from "@/components/AvatarStage";
import { ChatPanel } from "@/components/ChatPanel";
import { CompactStatus, MindHud } from "@/components/MindHud";
import { Labs } from "@/components/Labs";
import { AppNavigation } from "@/components/AppNavigation";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { MotivationPanel } from "@/components/MotivationPanel";
import { SettingsPanel } from "@/components/SettingsPanel";
import { RuntimeHealthPanel } from "@/components/RuntimeHealthPanel";
import { CommandPalette } from "@/components/CommandPalette";
import { useKurisu, type AppSection } from "@/organism/store";
import { emptySnapshot } from "@/organism/types";
import { ResearchDock } from "@/research/ResearchDock";
import { IntegrationConsole } from "@/components/IntegrationConsole";
import { HexisControlConsole } from "@/components/HexisControlConsole";
import { RuntimeAtlas } from "@/components/RuntimeAtlas";
import { LettaGovernanceConsole } from "@/components/LettaGovernanceConsole";
import { ConscioControlConsole } from "@/components/ConscioControlConsole";
import { ConstitutionEvolutionConsole } from "@/components/ConstitutionEvolutionConsole";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const snap = useKurisu((s) => s.snap) ?? emptySnapshot();
  const busy = useKurisu((s) => s.busy);
  const hydrate = useKurisu((s) => s.hydrate);
  const tickIdle = useKurisu((s) => s.tickIdle);
  const hydrated = useKurisu((s) => s.hydrated);
  const connection = useKurisu((s) => s.connection);
  const section = useKurisu((s) => s.section);
  const setSection = useKurisu((s) => s.setSection);
  const setTab = useKurisu((s) => s.setTab);

  useLayoutEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    const id = window.setInterval(() => void tickIdle(), 1400);
    return () => window.clearInterval(id);
  }, [hydrated, tickIdle]);

  const navigate = (next: AppSection) => {
    setSection(next);
    if (next === "memory") setTab("memory");
    if (next === "more") setTab("mind");
  };

  return (
    <main className="min-h-dvh bg-bg px-3 pb-24 pt-4 md:px-6 md:pt-6">
      <header className="mx-auto mb-4 flex max-w-7xl flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-subtle">NeuroCore · NK1</p>
          <h1 className="font-display text-3xl tracking-tight text-fg md:text-4xl">Kurisu</h1>
          <p className="mt-1 text-xs text-muted">
            {connection.lastSyncedAt === null
              ? "Canonical organism state has not been confirmed"
              : (snap.awake ? "Awake" : "Asleep") + " · tick " + snap.tick}
          </p>
        </div>
        <ConnectionStatus />
      </header>

      {section === "home" ? (
        <section className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)_minmax(240px,280px)]" aria-label="Home">
          <div className="space-y-3">
            <AvatarStage snap={snap} thinking={busy} />
            <div className="lg:hidden"><CompactStatus snap={snap} connection={connection} /></div>
            <p className="hidden text-xs leading-relaxed text-muted lg:block">
              One canonical organism state · one owner per cognitive function · renderers are projections.
            </p>
          </div>
          <div className="flex min-h-[480px] flex-col md:min-h-[520px]">
            <ChatPanel />
          </div>
          <div className="hidden lg:block">
            <MindHud snap={snap} connection={connection} />
          </div>
        </section>
      ) : null}

      {section === "memory" ? (
        <section className="mx-auto max-w-7xl space-y-3" aria-label="Memory">
          <div><h2 className="font-display text-2xl text-fg">Memory</h2><p className="text-sm text-muted">Search and inspect the memories, beliefs and knowledge published by the canonical runtime.</p></div>
          <Labs snap={snap} />
        </section>
      ) : null}

      {section === "motivation" ? (
        <section className="mx-auto max-w-7xl space-y-3" aria-label="Motivation">
          <div><h2 className="font-display text-2xl text-fg">Motivation</h2><p className="text-sm text-muted">Goals and homeostatic drives, read-only from the organism snapshot.</p></div>
          <MotivationPanel snap={snap} connection={connection} />
        </section>
      ) : null}

      {section === "settings" ? (
        <section className="mx-auto max-w-7xl space-y-3" aria-label="Settings">
          <div><h2 className="font-display text-2xl text-fg">Settings</h2><p className="text-sm text-muted">User-facing voice and embodiment preferences. These settings do not modify the organism's internal goals or personality.</p></div>
          <SettingsPanel snap={snap} />
        </section>
      ) : null}

      {section === "more" ? (
        <section className="mx-auto max-w-7xl space-y-4" aria-label="More tools and diagnostics">
          <div><h2 className="font-display text-2xl text-fg">More</h2><p className="text-sm text-muted">Research, integration, governance and diagnostic workspaces.</p></div>
          <RuntimeHealthPanel />
          <Labs snap={snap} />
          <ResearchDock />
          <IntegrationConsole />
          <HexisControlConsole />
          <RuntimeAtlas />
          <LettaGovernanceConsole />
          <ConscioControlConsole />
          <ConstitutionEvolutionConsole />
        </section>
      ) : null}

      <footer className="mx-auto mt-6 max-w-7xl text-center text-[10px] text-subtle">
        Canonical state is authoritative · local preferences affect presentation only · 2.5D remains gated
      </footer>

      <CommandPalette />
      <AppNavigation active={section} onSelect={navigate} />
    </main>
  );
}
