# NEURO-KURISU — BIG PASS 185
## Hippocampal / Neocortical-style Memory ↔ Central Brain

Статус: IMPLEMENTED + INTEGRATED + VERIFIED (targeted), research-grade status: NOT YET

### Что изменено

1. Добавлен `HippocampalMemorySubstrate`.
   - быстрые episodic traces;
   - компактные 64-мерные bound representations;
   - binding с текущим latent CentralBrain;
   - recall по learned representations;
   - replay prioritization;
   - медленное schema/prototype learning;
   - exact snapshot/restore;
   - bounded storage.

2. `MemoryOS2` остался каноническим memory store.
   Hippocampal substrate не создаёт альтернативный источник истины: он обучается от существующих memory items и хранит специализированное learned state.

3. Центральный brain теперь получает hippocampal retrieval features.
   Благодаря этому прошлые эпизоды и learned schemas могут менять следующий recurrent state CentralBrain.

4. После live memory encoding текущий central latent привязывается к эпизоду.
   На scheduled consolidation hippocampal traces replay-ятся и обновляют slow schemas.

5. Recall time переведён на `state.at`, а не на скрытый wall-clock, чтобы persisted evidence было воспроизводимым.

6. Добавлен `audit:big-pass-185`.

### Проверки

- TYPECHECK=PASS
- BIG PASS 185 hippocampal substrate=PASS
- BIG PASS 183 central brain regression=PASS
- P27 learned world=PASS
- P27 integration=PASS
- AUDIT_BRAIN=PASS
- CLEAN_ARCHITECTURE=PASS
- CLEAN_INTEGRITY=PASS
- FORENSICS=PASS
- SOURCE_HYGIENE=PASS
- RELEASE_SOURCE=PASS
- BIG PASS 181 function reality closure: 199/199 PASS, failed=0, skipped=0

### Важное ограничение

Нельзя пока утверждать, что hippocampal substrate воспроизводит биологический hippocampus или что CentralBrain является сознанием. Сейчас доказано только наличие работающего computational mechanism fast episodic trace → replay → slow schema learning → retrieval features → recurrent central state integration.

### Научная мотивация

Complementary Learning Systems связывает быстрый эпизодический hippocampal learning и медленное извлечение статистической структуры неокортексом. Современные данные 2026 года также поддерживают более сложную внутреннюю специализацию hippocampal learning, включая разделение rapid episode formation и более постепенного structure learning.

Источники:
- McClelland, McNaughton & O’Reilly (1995), Complementary Learning Systems.
- Kumaran, Hassabis & McClelland (2016), What Learning Systems Do Intelligent Agents Need?
- Singh & Schapiro (2026), Evidence for complementary learning systems within the hippocampus.
- Mack, Love & Preston (2026), Distinct Hippocampal Mechanisms Support Concept Formation and Updating.
- 2026 Nature/EMM review literature on systems consolidation and hippocampal involvement in remote memory.

### Следующий Giant Step

B4 — Predictive Self + Agency Brain:
intention → predicted consequence → action → sensed consequence → ownership/authorship → self/other attribution → learning.

Особое требование B4: self model должен стать latent dynamical model, а не набором scalar identity scores. Центральный brain должен получать и предсказывать self-state, а agency loop — проверять причинную принадлежность действия.
