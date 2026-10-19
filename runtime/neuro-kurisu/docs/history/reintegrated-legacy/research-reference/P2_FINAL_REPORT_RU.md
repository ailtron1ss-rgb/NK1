# P2 — финальный технический отчёт

P2 превращает виртуальную физиологию в отдельный embodied boundary: battery, temperature/thermal strain, CPU/RAM pressure, sensor freshness, sleep/wake, TTS/STT capability и ограничения вычислительной ёмкости.

Ключевой принцип: реальные данные Android являются наблюдениями, а не декорацией. При отсутствии Termux:API система возвращается к / источнику и явно хранит .

## API

- GET 
- POST 
- POST 
- POST 
- POST 
- POST 

## Безопасность/надёжность

-  по умолчанию остаётся localhost.
- Termux commands вызываются с finite timeout.
- Wake lock используется только в внешнем service script и всегда освобождается в .
- Физическая доступность камеры/микрофона/TTS/STT не подменяется фиктивным .
