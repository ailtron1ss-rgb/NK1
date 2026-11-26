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
        <section className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(250px,320px)]" aria-label="Home">
          <div className="order-2 flex min-h-[520px] flex-col lg:order-1">
            <ChatPanel />
          </div>
          <aside className="order-1 space-y-3 lg:order-2">
            <button
              type="button"
              onClick={() => setSection("avatar")}
              aria-label="Open Kurisu avatar and embodiment controls"
              className="group flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition hover:border-accent/50 hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="size-24 shrink-0 overflow-hidden rounded-lg border border-border bg-elevated">
                <img
                  src="/sprites/kurisu/thinking_chin.png"
                  alt="Kurisu in a thoughtful pose"
                  loading="lazy"
                  className="h-full w-full object-cover object-center"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] uppercase tracking-widest text-subtle">Your companion</span>
                <span className="mt-1 block font-display text-xl text-fg">Kurisu</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted">Open avatar, expressions, voice and renderer controls.</span>
                <span className="mt-2 block text-xs font-medium text-accent">Open avatar →</span>
              </span>
            </button>
            <div className="lg:hidden">
              <CompactStatus snap={snap} connection={connection} />
            </div>
            <div className="hidden lg:block">
              <MindHud snap={snap} connection={connection} />
            </div>
          </aside>
        </section>
      ) : null}

      {section === "avatar" ? (
        <section className="mx-auto max-w-7xl space-y-4" aria-label="Avatar">
          <header>
            <p className="text-xs uppercase tracking-widest text-subtle">Embodiment · Renderer workspace</p>
            <h2 className="font-display text-2xl text-fg md:text-3xl">Kurisu · Avatar</h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">
              One organism state, one selected renderer. Voice, expression and movement are projected from the current runtime snapshot.
            </p>
          </header>
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-w-0">
              <AvatarStage snap={snap} thinking={busy} />
            </div>
            <aside className="space-y-3">
              <CompactStatus snap={snap} connection={connection} />
              <section className="rounded-xl border border-border bg-surface p-4" aria-label="Renderer capabilities">
                <h3 className="font-display text-lg text-fg">Renderer capabilities</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">The labels describe the actual renderer type, not an equal level of production readiness.</p>
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-fg">Live2D · primary</p>
                    <p className="text-xs text-muted">Cubism deformable 2D rig, expressions, motion and speech projection.</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-fg">NK1 Original · vector</p>
                    <p className="text-xs text-muted">Editable SVG stage with limited vector animation, not a full skeletal rig.</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-fg">Legacy · sprite fallback</p>
                    <p className="text-xs text-muted">Static PNG poses with visual transitions; no deformable character rig.</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-fg">3D · preview</p>
                    <p className="text-xs text-muted">VRM/GLB candidate renderer; visual, device and contact acceptance remain separate gates.</p>
                  </div>
                  <div className="border-t border-border pt-3">
                    <p className="text-sm font-medium text-muted">2.5D · not enabled</p>
                    <p className="text-xs text-muted">Awaiting authored layered artwork, masks, pivots and device acceptance.</p>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </section>
      ) : null}

      {section === "memory" ? (
        <section className="mx-auto max-w-7xl space-y-3" aria-label="Memory">
          <div><h2 className="font-display text-2xl text-fg">Memory & knowledge</h2><p className="text-sm text-muted">Search and inspect the memories, beliefs and knowledge published by the canonical runtime.</p></div>
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
          <div><h2 className="font-display text-2xl text-fg">More</h2><p className="text-sm text-muted">Motivation, research, integration, governance and diagnostic workspaces.</p></div>
          <MotivationPanel snap={snap} connection={connection} />
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
