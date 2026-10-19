# Termux quick

```bash
cd Nullseed_Evolution_76.0.0
python runtime/nullseed_cli.py smoke
python runtime/nullseed_cli.py invent_fast
python runtime/nullseed_cli.py metrics
# panel: open runtime/metrics_panel.html after metrics.json exists
# python -m http.server -d runtime 8765  then browser localhost:8765/metrics_panel.html
```
