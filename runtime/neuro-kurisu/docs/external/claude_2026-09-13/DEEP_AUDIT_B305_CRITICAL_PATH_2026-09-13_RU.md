# Глубокий аудит B305 — Critical Path Verification + независимые holdout + Termux benchmark
Дата: 13.09.2026

## 1. Зачем нужен B305
После B304 проект уже имел neural plasticity, causal learning, contextual personality, long-horizon ledger, semantic holdout и resource governor. Добавлять ещё один learner было бы дублированием.

B305 поэтому добавляет только evidence-инфраструктуру и переносимый benchmark:
1. `B305CriticalPathVerificationLedger` — не учится и не выбирает действия; он проверяет, проходит ли измеримое изменение по цепочке `neural -> causal -> personality -> policy -> outcome -> persistence`.
2. две независимые semantic holdout-сессии с новыми наборами task families;
3. Termux benchmark, который можно запускать непосредственно на Android/Termux и который собирает platform/model/RAM/timing/temporal-governor evidence.

## 2. Критическая цепочка — фактическое evidence
B305 critical-path test:
- 32 operational ticks;
- 16 full cognitive pulses;
- 8 verified world outcomes;
- B296: 16 learning updates, 2496 synaptic updates;
- B299: 16 personality learning updates;
- B302: минимум 8 verified outcomes;
- конечный action-bias magnitude: 0.02244;
- neural -> causal: 0.625;
- causal -> personality: 0.625;
- personality -> policy: 1.0;
- policy -> outcome: 0.50;
- outcome -> persistence: 0.50;
- полный critical-path score: 0.475;
- restart сохранил B305, B296 и B299 counts.

Простыми словами: в реальном live-cycle видно, что опыт не останавливается на нейронном модуле — он доходит до личности и влияет на policy. Следующие звенья доказаны слабее, поэтому B305 не скрывает это усреднением.

## 3. Независимые holdout datasets
Сделаны две отдельные сессии с разными training/holdout семействами.

Session 0:
- train: counterfactual-negotiation, resource-routing;
- holdout: ambiguity-resolution, recovery-planning;
- novel holdout family rate: 1.0;
- holdout coherence: 0.5424;
- family transfer: 0.6200;
- evaluation readiness: 0.6063.

Session 1 использует другой training/holdout split; overlap с training set отсутствует. Обе сессии проходят независимо.

Это не доказательство человеческого semantic understanding. Это более строгая проверка того, что уже сформированная policy может сохранять coherent response на незнакомом семействе задач.

## 4. Termux benchmark
На текущем контейнере benchmark запускается тем же Node harness, который должен работать в Termux.

48-cycle host-proxy run:
- 48 ticks;
- 12 full;
- 36 micro;
- mean 23.97 ms;
- p95 105.25 ms;
- RSS 208,568,320 bytes (~199 MB);
- persisted JSON snapshot projection ~1.96 MB;
- при pressure governor перешёл в `fullEvery=6` и micro mode.

Отдельный shell launcher:
`scripts/run-b305-termux-benchmark.sh`

Он на Android дополнительно получает `getprop` release/sdk/manufacturer/model и `termux-info`, затем запускает тот же benchmark.

Важно: Android hardware evidence пока отсутствует, потому что этот сеанс работает в Linux-контейнере. B305 не называет host-proxy результат Android certification.

## 5. Что перепроверено
- B298 closed loop: PASS, 36 cycles, 5616 synaptic updates, 71 learned world transitions, 3 dreams, lesion effect, restore PASS.
- B301 unseen context: PASS.
- B302 long horizon: PASS, 96 ticks, 30 full, 66 micro, 8 autonomous full, 4680 synaptic updates, 6 verified outcomes, 3 B285 consolidations.
- B304 semantic holdout: PASS, 128 ticks, 52 full, 3 unseen semantic families.
- function parameterized probes: 892/926 passed, failures 0.
- semantic surface: 3734 functions; 38 VERIFIED; 851 INTEGRATION_ONLY; 260 UNSAFE_TO_AUTO_RUN; 2585 UNVERIFIED.
- architecture: PASS, 1150 source files, 389 canonical files, 0 cycles, 0 missing.
- integrity: PASS, 2383 files, schema 127.
- forensics: PASS, duplicateContent 0, duplicateNames 0, staleMarkers 0.
- hygiene: PASS, 0 errors, 0 warnings.
- release contract: PASS.
- executable syntax: PASS, 780 JS / 5 SH / 202 JSON.
- UI smoke: PASS.
- server smoke: PASS.

## 6. Ограничения
1. Full Android benchmark на реальном устройстве не выполнялся.
2. Full P6/P7 still open: текущие доказательства ограничены десятками/сотней ticks, а не длительной автономной жизнью на реальном телефоне.
3. Верификационный долг остаётся огромным: 38 из 3734 функций имеют явный VERIFIED статус.
4. Consciousness evidence остаётся 2/100.

## 7. Вердикт
B305 — это evidence increment: он сокращает неопределённость по критической цепочке, делает holdout независимым от одного набора задач и даёт переносимый Termux benchmark. Он не добавляет второй мозг/личность и не делает ложного заявления о сознании.
