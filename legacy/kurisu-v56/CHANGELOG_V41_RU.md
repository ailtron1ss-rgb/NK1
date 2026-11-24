# Neuro-Kurisu v4.1 — итоговые изменения

## Исправления
- Убран Android-опасный сценарий с `onnxruntime-node`; npm-зависимости остаются browser-safe.
- Исправлен голосовой ввод: повторное нажатие теперь действительно останавливает текущую сессию SpeechRecognition.
- Убрана искусственная установка коротких ответов в системном промпте; длина теперь зависит от сложности задачи.
- Добавлен явный контроль честности: система не выдаёт служебные рассуждения за пользовательский «thought bubble».
- Исправлен тип `AutonomousSettings` для `autoSendSMS`.

## Новое
- `RuntimeGovernor`: Performance / Balanced / PowerSave.
- Автоматическое ограничение фоновых задач и локальной модели на слабом/разряженном устройстве.
- Опциональная native-телеметрия CPU temperature/RAM без выдумывания данных в браузере.
- Ebbinghaus-inspired decay для долговременной памяти.
- Ассоциативный граф памяти `MemoryAssociator` с лёгкими связями между похожими эпизодами.
- Безопасный server-side self-audit по allowlist файлов.
- Создание rollback snapshot исходников перед потенциальной эволюцией.
- Расширенная документация по безопасному самоулучшению.
- Termux-инструкция v4.1.

## Архитектурное решение
Полное автономное переписывание исходников нейросетью намеренно не включено. Модель может анализировать разрешённые файлы и предлагать изменения, но изменение исходников требует подтверждения и резервной копии. Это позволяет сохранить идею самоэволюции без превращения приложения в неконтролируемый исполнитель произвольного кода.

## Что уже было сохранено из v4.0
- Cloud + browser-local neural routing.
- Continuum memory / ALAS rehearsal / sleep-dream layer.
- Cognitive orchestrator, personality drift, goals, metacognition.
- Live2D/static fallback architecture.
- TTS/STT, multimodal input, proactive initiative.
- SelfImprovementEngine с approval/rollback для runtime-конфигурации.
