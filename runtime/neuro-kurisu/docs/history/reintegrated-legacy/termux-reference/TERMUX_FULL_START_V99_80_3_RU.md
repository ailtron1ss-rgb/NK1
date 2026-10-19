# Neuro-Kurisu v99.80.3 — Termux с нуля

1. `termux-setup-storage`
2. `pkg update -y && pkg upgrade -y && pkg install -y nodejs-lts unzip git python clang make pkg-config curl`
3. Положите ZIP в `~/storage/downloads/`.
4. `bash ~/storage/downloads/INSTALL_V99_80_3.sh`
5. `cd ~/v96work`
6. `npm install`
7. `npm run verify:audit-repair-v99-80-3`
8. `npm run build:phone-safe`
9. `npm start`
10. Откройте `http://127.0.0.1:3000`.

Важно: build/dist создаётся локально; production runtime нельзя считать подтверждённым без успешной установки зависимостей и build.
