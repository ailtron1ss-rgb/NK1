import { useEffect, useLayoutEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AvatarStage } from "@/components/AvatarStage";
import { DEFAULT_RENDERER_MANIFESTS } from "@/components/avatar/rendererRegistryDefaults";
import type { AvatarAssetKind } from "@/components/avatar/rendererCapabilityManifest";
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

const RENDERER_ASSET_LABELS: Record<AvatarAssetKind, string> = {
  "cubism-model": "Деформируемый риг Cubism",
  "svg-vector": "SVG-вектор",
  "sprite-sheet": "Набор статичных PNG-поз",
  gltf: "Модель GLB / glTF",
  vrm: "Модель VRM",
  "layered-depth-rig": "Многослойный 2.5D-риг",
  none: "Без ассета",
};

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
              ? "Каноническое состояние организма ещё не подтверждено"
              : (snap.awake ? "Бодрствует" : "Спит") + " · tick " + snap.tick}
          </p>
        </div>
        <ConnectionStatus />
      </header>

      {section === "home" ? (
        <section className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(250px,320px)]" aria-label="Главная">
          <div className="order-2 flex min-h-[520px] flex-col lg:order-1">
            <ChatPanel />
          </div>
          <aside className="order-1 space-y-3 lg:order-2">
            <button
              type="button"
              onClick={() => setSection("avatar")}
              aria-label="Открыть аватар Курису и настройки воплощения"
              className="group flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition hover:border-accent/50 hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="size-24 shrink-0 overflow-hidden rounded-lg border border-border bg-elevated">
                <img
                  src="/sprites/kurisu/thinking_chin.png"
                  alt="Курису в задумчивой позе"
                  loading="lazy"
                  className="h-full w-full object-cover object-center"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] uppercase tracking-widest text-subtle">Твой компаньон</span>
                <span className="mt-1 block font-display text-xl text-fg">Kurisu</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted">Открой аватар, выражения, голос и настройки рендерера.</span>
                <span className="mt-2 block text-xs font-medium text-accent">Открыть аватар →</span>
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
        <section className="mx-auto max-w-7xl space-y-4" aria-label="Аватар">
          <header>
            <p className="text-xs uppercase tracking-widest text-subtle">Воплощение · Панель рендереров</p>
            <h2 className="font-display text-2xl text-fg md:text-3xl">Курису · Аватар</h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">
              Единое состояние организма и один выбранный рендерер. Голос, выражение и движение проецируются из актуального снимка runtime.
            </p>
          </header>
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-w-0">
              <AvatarStage snap={snap} thinking={busy} />
            </div>
            <aside className="space-y-3">
              <CompactStatus snap={snap} connection={connection} />
              <section className="rounded-xl border border-border bg-surface p-4" aria-label="Возможности рендереров">
                <h3 className="font-display text-lg text-fg">Возможности рендереров</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">Подписи отражают фактический тип рендерера, а не одинаковую степень готовности к выпуску.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {DEFAULT_RENDERER_MANIFESTS.map((renderer) => (
                    <article key={renderer.rendererId} className="min-w-0 rounded-lg border border-border bg-elevated/70 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h4 className="text-sm font-medium text-fg">{renderer.label}</h4>
                        <span className={renderer.productionReady
                          ? "rounded-full border border-border px-2 py-0.5 text-[9px] text-muted"
                          : "rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[9px] text-amber-200"
                        }>
                          {renderer.productionReady ? "Доступен в селекторе" : "Preview · не production"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted">
                        {RENDERER_ASSET_LABELS[renderer.assetKind]} · {renderer.channels.length > 0
                          ? `${renderer.channels.length} управляемых каналов`
                          : "Нет управляемых каналов"}
                      </p>
                      <p className="mt-1 text-[10px] leading-relaxed text-subtle">
                        {renderer.expressions.length} выражений · речь/viseme {renderer.supportsSpeechVisemes ? "поддерживается" : "не поддерживается"} · физика {renderer.supportsPhysics ? "есть" : "нет"}
                      </p>
                      {!renderer.productionReady ? (
                        <p className="mt-2 border-t border-border pt-2 text-[10px] leading-relaxed text-muted">
                          Требуется визуальная, мобильная и лицензионная приёмка.
                        </p>
                      ) : null}
                    </article>
                  ))}
                  <div className="rounded-lg border border-dashed border-border p-3 sm:col-span-2">
                    <p className="text-sm font-medium text-muted">2.5D · пока недоступен</p>
                    <p className="mt-1 text-xs text-muted">Ожидает готовой многослойной графики, масок, pivot-точек и проверки на устройствах.</p>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </section>
      ) : null}

      {section === "memory" ? (
        <section className="mx-auto max-w-7xl space-y-3" aria-label="Нейропамять и знания">
          <div><h2 className="font-display text-2xl text-fg">Нейропамять и знания</h2><p className="text-sm text-muted">Поиск и просмотр воспоминаний, убеждений и знаний, опубликованных каноническим runtime.</p></div>
          <Labs snap={snap} />
        </section>
      ) : null}

      {section === "motivation" ? (
        <section className="mx-auto max-w-7xl space-y-3" aria-label="Мотивация">
          <div><h2 className="font-display text-2xl text-fg">Мотивация</h2><p className="text-sm text-muted">Цели и гомеостатические потребности. Данные доступны для просмотра из снимка организма.</p></div>
          <MotivationPanel snap={snap} connection={connection} />
        </section>
      ) : null}

      {section === "settings" ? (
        <section className="mx-auto max-w-7xl space-y-3" aria-label="Настройки">
          <div><h2 className="font-display text-2xl text-fg">Настройки</h2><p className="text-sm text-muted">Настройки голоса и воплощения. Они не изменяют внутренние цели или личность организма.</p></div>
          <SettingsPanel snap={snap} />
        </section>
      ) : null}

      {section === "more" ? (
        <section className="mx-auto max-w-7xl space-y-4" aria-label="Инструменты и диагностика">
          <div><h2 className="font-display text-2xl text-fg">Инструменты и диагностика</h2><p className="text-sm text-muted">Рабочие пространства мотивации, исследований, интеграций, управления и диагностики.</p></div>
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
        Каноническое состояние — источник истины · локальные настройки влияют только на отображение · 2.5D пока заблокирован
      </footer>

      <CommandPalette />
      <AppNavigation active={section} onSelect={navigate} />
    </main>
  );
}
