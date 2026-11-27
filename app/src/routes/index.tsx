import { useEffect, useLayoutEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AvatarStage } from "@/components/AvatarStage";
import { ChatPanel } from "@/components/ChatPanel";
import { CompactStatus, MindHud } from "@/components/MindHud";
import { Labs } from "@/components/Labs";
import { useKurisu } from "@/organism/store";
import { emptySnapshot } from "@/organism/types";
import { ResearchDock } from "@/research/ResearchDock";
import { IntegrationConsole } from "@/components/IntegrationConsole";
import { HexisControlConsole } from "@/components/HexisControlConsole";
import { RuntimeAtlas } from "@/components/RuntimeAtlas";
import { LettaGovernanceConsole } from "@/components/LettaGovernanceConsole";
import { ConscioControlConsole } from "@/components/ConscioControlConsole";
import { ConstitutionEvolutionConsole } from "@/components/ConstitutionEvolutionConsole";
import { RuntimeHealthPanel } from "@/components/RuntimeHealthPanel";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const snap = useKurisu((s) => s.snap) ?? emptySnapshot();
  const busy = useKurisu((s) => s.busy);
  const hydrate = useKurisu((s) => s.hydrate);
  const tickIdle = useKurisu((s) => s.tickIdle);
  const hydrated = useKurisu((s) => s.hydrated);

  useLayoutEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    const id = window.setInterval(() => tickIdle(), 1400);
    return () => window.clearInterval(id);
  }, [hydrated, tickIdle]);

  return (
    <main className="min-h-dvh bg-bg px-3 py-4 md:px-6 md:py-6">
      <header className="mx-auto mb-4 flex max-w-7xl flex-col items-stretch gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-subtle">NeuroCore · digital organism</p>
          <h1 className="font-display text-3xl tracking-tight text-fg md:text-4xl">NeuroCore</h1>
        </div>
        <div className="flex flex-col items-start gap-1 text-left text-xs text-muted sm:items-end sm:text-right">
          NK1 cognitive runtime · persistent identity
          <br />
          <span className="tabular-nums">
            {snap.awake ? "awake" : "asleep"} · tick {snap.tick}
          </span>
        </div>
        <RuntimeHealthPanel />
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[280px_minmax(0,1fr)_260px]">
        <div className="space-y-3">
          <AvatarStage snap={snap} thinking={busy} />
          <div className="lg:hidden">
            <CompactStatus snap={snap} />
          </div>
          <p className="hidden text-xs leading-relaxed text-muted lg:block">
            Canonical loop: observe → predict → retrieve → workspace → option → act → learn →
            persist. One owner per function.
          </p>
        </div>
        <div className="flex min-h-[480px] flex-col md:min-h-[520px]">
          <ChatPanel />
        </div>
        <div className="hidden lg:block">
          <MindHud snap={snap} />
        </div>
      </div>

      <div className="mx-auto mt-4 max-w-7xl">
        <Labs snap={snap} />
        <div className="mt-4"><ResearchDock /></div>
        <div className="mt-4"><IntegrationConsole /></div>
        <HexisControlConsole />
        <RuntimeAtlas />
        <LettaGovernanceConsole />
        <ConscioControlConsole />
        <ConstitutionEvolutionConsole />
      </div>

      <footer className="mx-auto mt-6 max-w-7xl text-xs text-subtle">
        NeuroCore · NK1 canonical runtime · Live2D / VRM / GLB embodiment bridge
      </footer>
    </main>
  );
}