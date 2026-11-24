# OmeStro #29 — Teacher–Student Distillation в NK1

**Статус на 17.11.2026:** реализован исследовательский pipeline подготовки проверенного корпуса, запуска SFT/LoRA через контролируемый процесс и независимого допуска кандидата к ручной проверке. Доказательств фактического обучения модели или улучшения качества пока нет.

## Назначение

Идея №29 из OmeStro.docx предлагает переносить отдельные компетенции сильной teacher-модели в меньшую локальную student-модель. NK1 адаптирует это как отдельный offline learning workstream. Он не меняет веса основной модели при обычном inference и не делает teacher-ответы истиной автоматически.

## Поток данных

Teacher provider → independent verifier → signed dataset → LLaMA Factory SFT/LoRA → LearningProcessSupervisor → independent baseline/student evaluation → one-shot holdout gate → manual review

1. **Manifest и разбиение.** Каждая задача имеет task/version/family/verifier и один split. Одно семейство задач может находиться только в одном split. Повторяющиеся нормализованные prompts не могут пересекать splits.
2. **Сбор teacher-ответов.** TeacherStudentDistillationDataset.collectTeacherExamples() обращается к injected teacher provider только для train/validation. Каждый вызов teacher и verifier имеет ограниченный deadline (по умолчанию 120 секунд, максимум 600 секунд), AbortSignal пробрасывается внутрь provider, зависшие вызовы не блокируют цикл сбора. Holdout prompts не передаются ни teacher, ни verifier в этом collection flow.
3. **Независимая проверка.** Отдельный verifier возвращает content-bound Ed25519 artifact схемы v2. Подпись покрывает manifest, task/version, family и split, teacher ID/model/revision, seed, fingerprints prompt/system/completion, evidence digest, verifier и timestamp. Подписанный family/split не позволяет перенести корректно подписанный ответ в другой разрез датасета. Встроенный fixture signer предназначен только для тестов.
4. **Целостность корпуса.** Приём проверяет доверенный публичный ключ, соответствие manifest и содержимого, плавающую версию модели, лимиты размера, секретоподобные строки, повторные artifacts/samples, конфликтующие результаты и дубликаты completion. Неверифицированные ответы не экспортируются.
5. **Экспорт.** exportLlamaFactoryShareGPT() формирует отдельные train.jsonl и validation.jsonl, dataset_info.json, manifest и отдельные signed provenance JSONL. В экспорт не включаются holdout prompts, responses, task IDs или метки. Evidence reference сохраняется как digest, а не исходный URL/путь.
6. **Защита файлов.** writeTeacherDistillationExport() записывает файлы через временный каталог, ограничивает права и отказывается перезаписывать существующие outputs.
7. **Конфигурация обучения.** createLlamaFactorySftConfig() генерирует pinned SFT/LoRA config с train/eval dataset names, cutoff, rank, LR, epochs, batch, gradient accumulation и опциональной 4/8-bit quantization. Floating model revisions запрещены.
8. **Исполнение.** runTeacherStudentDistillationTraining() перед spawn проверяет realpath workspace/dataset/config, открывает конфиг и корпус через no-follow file handles, сверяет inode/size/mtime до и после чтения, ограничивает суммарный размер корпуса, отклоняет пустые JSONL-строки и symlink-файлы, принимает только плоский allowlist LLaMA Factory config без неизвестных/повторных ключей, проверяет config fingerprint, manifest fingerprint, hashes train/validation/provenance/dataset_info, row counts, каждую связь prompt/system/completion ↔ signed provenance, Ed25519 verifier, family/split из подписи, разбиение по семействам, дубликаты и полный dataset fingerprint. При любой подмене тренер не запускается. Затем llamafactory-cli train запускается через существующий LearningProcessSupervisor с shell:false, timeout, output cap, cancellation и минимальным non-secret environment. Process receipt доказывает только факт выполнения процесса — не корректность или улучшение модели.
9. **Оценка.** TeacherStudentDistillationGate принимает только outcomes с authority independent-verifier и действующим in-process authenticated evidence receipt из VerifiedOutcomeArtifact. Сравнение парное по seed и по полному набору задач. Публикуются общий и family-stratified holdout summaries и deterministic bootstrap 95% CI.
10. **Однократное использование holdout.** Gate потребляет candidate fingerprint до анализа, блокирует повторное использование того же candidate, состояние snapshot должно сохраняться доверенным host-owned persistence. При повреждённом/переполненном состоянии gate закрывается. Успешный результат означает только eligible-for-manual-review; автоматическая активация всегда выключена.

## Код и контракты

- runtime/neuro-kurisu/src/organism/learning/TeacherStudentDistillation.ts — manifest, teacher collection, Ed25519 admission, dedup, ShareGPT export, provenance, LoRA config.
- runtime/neuro-kurisu/src/organism/learning/TeacherStudentDistillationTrainer.ts — безопасная обёртка LLaMA Factory над LearningProcessSupervisor.
- runtime/neuro-kurisu/src/organism/learning/TeacherStudentDistillationGate.ts — paired-seed validation/holdout gate, family regressions, one-shot candidate consumption.
- runtime/neuro-kurisu/tests/teacher-student-distillation.mjs — regression contract, fake local trainer boundary, signature/export/holdout/gate tests.
- runtime/neuro-kurisu/package.json — test:teacher-student-distillation.
- .github/workflows/workpass71-validation.yml — запуск теста в core CI.

## Запуск в runtime workspace

Из каталога runtime:

~~~bash
npm run test:teacher-student-distillation
npm run typecheck
~~~

Для рабочего запуска сначала создаётся датасет из задач, для которых доступны независимый teacher-verifier и доверенный публичный ключ verifier. Дальше export и конфигурация создаются через API модуля. Оператор устанавливает LLaMA Factory отдельно и передаёт путь к config в runTeacherStudentDistillationTraining(). Нельзя помещать приватные verifier keys в NK1 runtime, dataset или Release ZIP.

## Критические границы

- В этой версии реализован **offline response-target SFT/LoRA**, а не on-policy token-level distillation по teacher logits.
- Hugging Face TRL DistillationTrainer поддерживает distillation loss на распределениях teacher/student и PEFT; это потенциальное отдельное расширение, но не заявляется как уже сделанное: https://huggingface.co/docs/trl/distillation_trainer
- Текущий экспорт использует ShareGPT conversations и from/value tags, описанные в документации LLaMA Factory: https://llamafactory.readthedocs.io/en/latest/getting_started/data_preparation.html
- Не интегрирован автоматический selection/switch нового student в production language backend. Это намеренно: сначала нужны независимые validation/holdout результаты и authenticated manual approval.
- Не проверены реальный teacher API, фактическое создание корпуса в production, LLaMA Factory installation, обучение на Dell G3/GTX 1650, реальная модель и качество, runtime latency, память и regressions on device.
- Не загружены веса модели и не создавался новый Release ZIP. Source branch / Draft PR не означают, что изменения вошли в published artifact.

## Следующие измеримые этапы

1. Подключить реальный teacher/verifier host adapter и подписывать artifact вне NK1 runtime.
2. Подготовить preregistered RU/EN task families с frozen train/validation/holdout manifest.
3. Запустить baseline и student на одинаковом количестве task/seed, с одинаковой средой и независимыми verifier-ами.
4. Провести обучение на целевом устройстве/среде; записать base/student model revision, tokenizer/template, quantization, trainer commit, config/dataset fingerprints, GPU layers, peak VRAM/RAM, time, tokens/s.
5. Сравнить task success, per-family regression, calibration, refusal/safety and catastrophic forgetting. Не допускать candidate к ручному review при отсутствии минимального holdout sample size или CI, пересекающем ноль.
6. Только после отдельного approval проектировать reversible adapter activation и rollback; не заменять базовую модель целиком.

**Определение завершения:** код и CI не заменяют фактическое обучение. Workstream может считаться экспериментально подтверждённым только после воспроизводимого run, независимой paired evaluation, holdout gate, проверки на целевом устройстве и сохранённого model artifact с provenance.
