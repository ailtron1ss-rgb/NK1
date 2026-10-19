#!/data/data/com.termux/files/usr/bin/bash
set -u

fail=0
run() {
  echo
  echo "===== $* ====="
  "$@" || fail=1
}

run npm install
run npm run lint
run npm run build

if [ "$fail" -ne 0 ]; then
  echo
  echo "Проверка завершилась с ошибками. Исправь первую ошибку сверху и повтори запуск."
  exit 1
fi

echo
echo "Все проверки завершены успешно."
