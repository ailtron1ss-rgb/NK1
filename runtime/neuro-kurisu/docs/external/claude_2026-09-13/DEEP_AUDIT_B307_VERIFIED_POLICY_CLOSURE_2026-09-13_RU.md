# Глубокий аудит B307 — Verified Policy Closure
Дата: 13.09.2026

## 1. Зачем нужен B307

B305 показал, что critical path `neural -> causal -> personality -> policy -> outcome -> persistence` существует, но слабым местом оставались последние два звена: обычная AdaptivePolicy училась на feedback, однако verified world/external outcomes не имели отдельного доверенного следа в policy state.

B306 доказал причинный вклад autonomous-personhood kernel в ranking действия, но не менял сам механизм долговременного policy closure.

B307 поэтому не создаёт новый learner. Он расширяет существующий `AdaptivePolicyEngine`:

`обычный policy value + verified/independent outcome value -> следующий action bias`

## 2. Реальное изменение

В `src/organism/learning/AdaptivePolicyEngine.ts` добавлены:
- `verifiedValue` для action/context row;
- `verifiedUpdates`;
- backward-compatible normalization старых rows, где этих полей нет;
- `observeVerifiedOutcome(...)`;
- `verifiedClosure(...)`;
- дополнительный trusted contribution в `bias(...)`.

В `OrganismCore.feedback(...)` verified branch запускается только при `worldTransition` или external evidence. Для неё используются:
- causal confidence B294;
- independent evidence flag;
- autonomous flag.

Состояние снова записывается в обычную `facets.learning.adaptivePolicy`; отдельного persistent store для B307 нет.

## 3. Evidence — unit level

Тест `tests/big-pass-307-verified-policy-closure.mjs`:
- baseline bias: `0`;
- после обычного нейтрального обучения: `0.032408`;
- после 12 verified positive outcomes: `0.073954`;
- `verifiedUpdates = 12`;
- `verifiedValue = 0.804363`;
- `verifiedClosure = 0.019631`;
- snapshot/restore сохраняет trusted branch и влияние.

Это доказывает, что verified outcome branch реально меняет вычисляемый policy bias, а не просто увеличивает диагностический счётчик.

## 4. Evidence — live OrganismCore

Live test:
- 32 operational ticks;
- 16 full cognitive cycles;
- 16 verified outcomes;
- 3 context/action policy rows получили verified evidence;
- максимум `verifiedUpdates = 10` в одной row;
- максимум `verifiedValue = 0.557969`;
- полный restart сохранил trusted policy evidence.

## 5. Регрессии

После B307 повторно пройдены:
- B306 autonomous causal verification — PASS: 16/16 eligible, 12/16 causal influence, rate `0.75`, causal success `0.9167`;
- B305 critical path — PASS: 32 ticks, 16 full, 8 verified, 2496 B296 synaptic updates;
- B298 closed loop — PASS: 36 cycles, 36 learning updates, 5616 synaptic updates, 71 learned world transitions, 3 dreams, restore PASS.

B298 отдельно измерен после B307: `24.28 s`, `532804 KB RSS`, exit 0.

## 6. Статический аудит

После B307:
- typecheck PASS;
- function liveness `pass=175`;
- parameterized probes `894/928`, failures `0`;
- semantic coverage `38 VERIFIED / 3751 function-like`;
- architecture PASS, `missing=0`, `cycles=0`, `legacyLeakage=0`;
- integrity PASS, schema `127`;
- forensics PASS, duplicate content `0`, duplicate names `0`, stale markers `0`;
- hygiene `0 errors / 0 warnings`;
- release contract PASS;
- syntax PASS;
- UI smoke PASS;
- server smoke PASS.

## 7. Простыми словами

До B307 политика в основном училась: «это действие дало такой reward».

После B307 у неё есть отдельный вопрос: «это действие дало такой результат, и этот результат был подтверждён world/external evidence и causal confidence — насколько этому опыту можно доверять при следующем выборе?»

Поэтому хороший подтверждённый опыт теперь имеет отдельный долгоживущий след и влияет на следующий action selection.

## 8. Отдельно проверенная negative evidence ветвь

При 12 verified negative outcomes (`reward=0.08`, causal confidence `0.86`, independent/autonomous = true) policy bias становится отрицательным. Это закрывает дефект старой односторонней функции `bias()`, которая могла только увеличивать предпочтение действия.

## 9. Что B307 не доказывает

B307 не доказывает сознание, свободную волю или человеческое понимание. Он закрывает более узкую инженерную проблему: verified outcomes теперь имеют отдельный action/context-conditioned policy closure и этот closure переживает persistence.

## 10. Ограничения

1. Реальный Android/Termux hardware run отсутствует; host-proxy benchmark не заменяет телефон.
2. P6/P7 остаются неполностью закрыты.
3. Semantic verification debt всё ещё велик.
4. Consciousness evidence остаётся низким.
5. Trusted branch пока проверена на коротком горизонте; нужен более долгий holdout, где verified learning меняет future action distribution, а не только bias value.
