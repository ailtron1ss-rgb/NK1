# Следующий frontier после V99

1. Сначала проверить V99 на более длинных streams и только при устойчивом gain рассматривать promotion.
2. Исследовать retention-prioritized synthesis (SAGO-like) поверх реального replay/current split, не создавая новый memory owner.
3. Сравнить PCGrad, conflict-weighted и no-arbitration при одинаковом compute budget.
4. Отдельно развивать end-to-end credit assignment/eligibility, чтобы уменьшить число искусственных stop-gradient границ в текущем cognitive loop.
5. Сохранять правило: candidate ≠ integrated; новый механизм проходит independent ablation и cost gate.

6. Исследовать e-prop/eligibility-based credit assignment как отдельный candidate path; BrainTrace предоставляет современную реализацию и описывает явное разделение local eligibility trace и global learning signal.
