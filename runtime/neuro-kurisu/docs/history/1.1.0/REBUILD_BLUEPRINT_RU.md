# Clean Rebuild Blueprint

## Canonical tree
```
src/
  organism/
    core/          # state transition + runtime ownership
    world/         # world model/environment/planning
    cognition/     # self, attention, workspace, values, authorship
    memory/        # event log + autobiographical/multi-timescale memory
    body/          # embodiment + Android/Termux bridge
    language/      # Kurisu identity constraints + language organ
    persistence/   # atomic storage + migrations
  server/          # stdlib HTTP bridge only
public/            # static UI only
scripts/           # release/audit scripts
scripts/termux/    # device start/supervisor
research/          # non-runtime research benchmarks
legacy-original/   # old project snapshot, never imported
```

## Dependency rule
Canonical runtime may depend only on sibling canonical domains and Node built-ins. No dependency on `legacy-original`, UI, or external npm packages.

## Release rule
`npm run release:audit` must pass before packaging. `REBUILD_MANIFEST.json` records the canonical/legacy boundary.
