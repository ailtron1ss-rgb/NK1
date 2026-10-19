# NEURO-KURISU 35.6.1 — B267 FULL BRAIN AUDIT

Дата: 2026-09-12
Основа: B266 verified release archive

## 1. Повторная перепроверка
Перед разработкой B267 повторно сверены B266 audit, B266 source, OrganismCore ownership, StateMigrations, B264 policy, B265 independent evaluator и B266 hidden-family evaluator.

Критическое уточнение после сверки: B264 в основном runtime-path получает outcome уже выбранного действия и обучается на нём; он не является единственной точкой action selection. Поэтому B267 не скрывает это различие, а вводит отдельный meta-controller: его online detector реально работает на outcome path OrganismCore, а adaptive arbitration явно принимает B264/B263 как входы для следующего решения.

## 2. Цель B267
Сделать изменение режима мира частью живой когнитивной петли, а не только отдельным benchmark.

Цепочка:
`outcome -> error/surprise/uncertainty -> regime shift -> mode -> verification/exploration/recovery -> adaptive arbitration -> holdout -> recovery`

## 3. Новый компонент
`src/organism/cognition/B267AdaptiveRegimeController.ts`

### Состояния
- baseline error/surprise/reward;
- fast error/surprise;
- bounded CUSUM-like shift score;
- uncertainty;
- recovery;
- current mode;
- verification/exploration counts;
- active information gain;
- post-shift gain;
- independent holdout gain.

### Режимы
- `exploit` — стабильный режим;
- `monitor` — ранний сигнал изменения;
- `explore` — поиск новой динамики;
- `verify` — активная проверка модели;
- `recover` — controlled return after successful adaptation.

## 4. Реальная интеграция
B267 встроен в:
- `OrganismCore` persisted system state;
- `StateMigrations`;
- live outcome path после B264 update;
- public adaptive arbitration API поверх B263+B264;
- snapshot/restart evidence.

## 5. Standalone evidence
Стабильный участок:
- 36 observations;
- mode=`exploit`;
- shiftCount=0.

После controlled regime shift:
- 28 shift observations;
- regimeShift01=`0.8592649085`;
- uncertainty01=`0.8793336214`;
- mode=`verify`;
- verificationCount=26;
- explorationCount=1;
- activeInformationGain01=`0.2221155460`.

После recovery call:
- recovery signal=`0.1476`;
- post-shift gain grows.

После последующей стабилизации:
- fastError01=`0.0800`;
- fastSurprise01=`0.0600`;
- regimeShift01 остаётся повышенным (`0.6593`) из-за накопленного CUSUM.

Это одновременно PASS и обнаруженный limitation: detector хорошо не пропускает сильный shift, но recovery hysteresis пока слишком медленный.

## 6. OrganismCore evidence
50 online observations:
- regimeShift01=`0.8424124267`;
- uncertainty01=`0.8597686280`;
- mode=`verify`;
- verificationCount=30;
- explorationCount=1;
- activeInformationGain01=`0.2161643192`;
- postShiftGain01=`0.1223793041`;
- holdoutGain01=`0.018`;
- B267 state persisted in snapshot.

Adaptive arbitration:
- 7 candidate actions;
- ranking generated from B264 causal policy + B263 interventions + B267 regime mode;
- adaptive score is distinct from raw B264 score.

## 7. Что реально доказано
1. Detector различает стабильный режим и controlled regime shift.
2. Shift увеличивает uncertainty и переводит controller в verification/exploration.
3. Это изменение отражается в реальном `OrganismCore` outcome loop.
4. Recovery signal существует и измеряется.
5. Adaptive arbitration меняет ranking кандидатов в зависимости от regime mode.
6. B267 state сохраняется и проходит migration.
7. B259-B266 regression остаётся работоспособной.

## 8. Что не доказано
- Не доказан open-world regime discovery.
- Не доказано самостоятельное создание новой причинной теории мира.
- Не доказана физическая external causal agency.
- Не доказано сознание.
- Не доказана AGI.
- Не доказано, что B267 сам выбирает правильное действие в произвольной новой среде без evaluator support.

## 9. Регрессионная матрица
PASS:
- B259 canonical neural substrate;
- B260 recurrent causal memory;
- B261 unified world model + Core;
- B262 multi-timescale world model + Core;
- B263 real action causality + Core;
- B264 causal policy + Core;
- B265 independent evaluator + migration + Core;
- B266 hidden task generalization + migration + Core;
- B267 standalone + migration + Core.

## 10. Инфраструктурные gate'ы
PASS:
- Typecheck;
- Full executable syntax sweep: `js=639, sh=4, json=163, failures=0`;
- Full audit: `1939 files, errors=0, warnings=0`;
- Architecture: `970 source files, 350 canonical, 0 cycles, 0 missing, legacyLeakage=0`;
- Integrity: `1945 files`;
- Source hygiene: `1939 files, errors=0, warnings=0`;
- Forensics: `1924 active files, empty=0, duplicateContent=0, duplicateNames=0, pathMarkers=0, staleMarkers=0`;
- Release contract;
- Lockfile;
- Release source;
- Doctor.

## 11. Оценки 1–100
| Component | Score |
|---|---:|
| Canonical neural substrate | 56 |
| Recurrent causal memory | 53 |
| Unified world model | 55 |
| Multi-timescale dynamics | 57 |
| Action causality | 61 |
| Causal policy | 66 |
| Independent evaluator | 72 |
| Hidden task generalization | 58 |
| Regime-shift detection | 67 |
| Uncertainty handling | 64 |
| Active information gain | 61 |
| Adaptive exploration/verification | 63 |
| Post-shift recovery | 54 |
| Long-horizon behaviour | 55 |
| Delayed reward | 57 |
| Adversarial robustness | 54 |
| Persistence | 97 |
| Migration discipline | 96 |
| Release engineering | 95 |
| Scientific evidence quality | 68 |
| Brain branch engineering | 88 |
| Overall brain scientific maturity | 68 |

Эти оценки не являются измерением интеллекта или сознания. Это инженерно-экспериментальная оценка качества реализации и доказательной базы.

## 12. Главный найденный недостаток B267
CUSUM-like accumulator слишком инерционен после сильного shift. Это безопасно в смысле «не объявлять мир снова стабильным слишком рано», но мешает быстрому восстановлению. Следующий проход должен ввести подтверждающий change-point test, asymmetric decay, time-to-recovery и независимую проверку полезности нового режима.

## 13. Следующий большой шаг
B268 должен замкнуть `detect -> verify -> hypothesis -> targeted experiment -> policy/model update -> independent evaluator -> commit/revert`.

Ключевой критерий:
система должна не просто заметить, что модель мира сломалась, а самостоятельно провести минимальный информативный эксперимент, изменить модель только при подтверждённом улучшении и уметь откатить неудачную адаптацию.

## 14. Итог
B267 — VERIFIED ENGINEERING PASS. Он переводит regime-shift adaptation из чистого benchmark в реальную часть runtime outcome loop.

Однако это всё ещё контролируемая цифровая среда. Никаких заявлений о сознании, AGI или полном открытом-world понимании делать нельзя.
