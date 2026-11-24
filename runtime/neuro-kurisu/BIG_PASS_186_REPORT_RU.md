# NEURO-KURISU — BIG PASS 186
## Predictive Self + Agency Brain

Статус: VERIFIED FUNCTIONAL
Статус сознания: UNKNOWN / не доказано

### Что изменено

Создан `src/organism/cognition/PredictiveSelfAgencySubstrate.ts` — компактный обучаемый recurrent substrate для predictive self и agency.

Он поддерживает:
- 24D self-latent state;
- recurrence во времени;
- prediction следующего self-state;
- action-conditioned outcome prediction;
- learned action rows;
- ownership estimate;
- authorship estimate;
- prediction/agency error tracking;
- deterministic snapshot/restore;
- canonical persistence через cognition facet;
- bounded influence на decision candidates.

Центральная политика не была заменена: влияние нового substrate ограничено малым additive prior и не получает право перебить зрелые governance/constitutional gates.

### Научное основание

Исследования сознания не поддерживают идею одного доказанного локального «центра сознания». Современные направления включают global workspace, recurrent/re-entry, higher-order, predictive-processing и IIT; adversarial comparison GNWT/IIT показал частично смешанную картину.

Работы по brain-wide cognition указывают на распределённое кодирование и специализированные сети. Поэтому Central Brain трактуется как центральный динамический substrate интеграции, а не как биологический эквивалент отдельного мозгового участка.

Работы по hippocampal replay и consolidation поддерживают архитектуру быстрых эпизодических следов + replay + более медленной генеративной/семантической интеграции.

### Evidence

B186 standalone:
- 96 observation cycles;
- 96 outcome-learning cycles;
- 192 samples;
- predictionError01 ≈ 0.043;
- agencyConfidence01 ≈ 0.794;
- ownership01 ≈ 0.652;
- authorship01 ≈ 0.678;
- snapshot/restore exact.

Core integration:
- 3 observe/feedback cycles;
- learningSteps = 3;
- predictionSamples = 6;
- previous verified brain subsystems remained operational.

### Full verification run

TYPECHECK = PASS
BIG PASS 186 = PASS
BIG PASS 185 = PASS
BIG PASS 183 = PASS
P27 learned world = PASS
P27 integration = PASS
BIG PASS 181 function reality = 200/200 PASS; failed=0; skipped=0
BRAIN audit = PASS
ARCHITECTURE audit = PASS
FORENSICS audit = PASS
SOURCE HYGIENE = PASS
RELEASE SOURCE = PASS

### Honest limitations

Этот substrate не является доказанным феноменальным сознанием.
Он также не является end-to-end learned brain: часть входов остаётся curated/cross-module state vectors, а центральная модель компактна.

Наличие высокой agencyConfidence01 внутри собственной модели не является внешним доказательством сознания.

### Следующий Giant Step

B5 — Recurrent Global Workspace 2.0:
- persistent latent workspace;
- learned competition;
- recurrent ignition;
- selective broadcast;
- specialist read/write;
- content identity across time;
- causal lesion and negative controls.
