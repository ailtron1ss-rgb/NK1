# V123 — Next Frontier

## Цель

Не добавлять очередную память. Сделать текущую sparse memory одновременно более устойчивой к collision и реально дешёвой на CPU/mobile.

### Большие шаги

1. **Collision-resistant addressing**
   - сравнить product-key collision rate при разных capacities;
   - исследовать compact slot fingerprint/key trace;
   - admission/replacement по match + strength + age;
   - exact multi-event recall и controlled overwrite.

2. **State representation rewrite**
   - уйти от обязательного full-bank Tensor clone на каждом token;
   - исследовать block-sparse/segmented runtime state;
   - сохранить сериализацию, deterministic reset и checkpoint compatibility;
   - измерять реальные memory bandwidth/FLOPs, а не только состояние в байтах.

3. **Matched end-to-end qualification**
   - delayed supervised recall;
   - continual learning;
   - interference/recovery;
   - distribution shift;
   - capacity scaling 256 / 1024 / 4096 slots;
   - 3–5 seeds с одинаковым data budget.

4. **Promotion gate**
   Кандидат включается в default только если одновременно выполняются: измеримый end-to-end gain, сохранение/улучшение long-horizon recall, контролируемый interference и приемлемая стоимость исполнения.

### V124 после V123

Unified memory consolidation: разделение fast-write / slow-consolidation без появления второго memory owner, с реальным экспериментом против текущего sparse substrate.
