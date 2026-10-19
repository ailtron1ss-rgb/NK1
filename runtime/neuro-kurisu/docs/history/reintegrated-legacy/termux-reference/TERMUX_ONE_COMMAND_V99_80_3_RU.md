# Neuro-Kurisu v99.80.3 — установщик в один шаг

Положите любой архив `Neuro_Kurisu*.zip` в `~/storage/downloads/`, затем выполните:

```bash
bash ~/storage/downloads/INSTALL_V99_80_3.sh
```

Установщик сам:
- находит самый свежий `Neuro_Kurisu*.zip`;
- делает backup `~/v96work`;
- распаковывает проект;
- устанавливает зависимости;
- запускает текущий audit-repair verifier;
- собирает production `dist`;
- проверяет production entry/assets.

После успешного завершения:

```bash
cd ~/v96work && npm start
```

Откройте `http://127.0.0.1:3000`.
