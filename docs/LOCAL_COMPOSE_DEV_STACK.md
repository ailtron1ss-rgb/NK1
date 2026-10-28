# Local Docker Compose development stack

This is a **local development / integration stack**, not the production deployment recipe. It runs the actual Vite/TanStack app and the actual Neuro-Kurisu runtime from the repository, with the same canonical runtime assets the app preflight uses.

## Start

Requirements: Docker Engine and the Docker Compose v2 plugin.

From the repository root:

```sh
docker compose -f compose.yaml up --build
```

After both services become healthy:

- App: http://127.0.0.1:8080
- Runtime health: http://127.0.0.1:3310/health
- Health through the app-to-runtime proxy: http://127.0.0.1:8080/api/health

The Vite proxy target is configurable with `NK1_RUNTIME_API_TARGET`. Host-run development keeps its existing default `http://127.0.0.1:3310`; Compose sets it to `http://runtime:3310` on the private Compose network.

## Data and safety boundaries

- Runtime state is persisted in the named `nk1-runtime-state` volume mounted at `/data`. `docker compose down` preserves it; `docker compose down --volumes` removes it.
- The app uses its local PGlite development fallback because this stack does not configure a production `DATABASE_URL`. That embedded app database is in-memory and resets when the app container is recreated. Do not use this stack for durable user/account data.
- Both ports are published on loopback only. The sample app auth flag is disabled for local development; do not expose this stack to a LAN or the public Internet.
- No Mem0 endpoint, embedding provider or language-model credentials are required for the basic smoke path. Optional providers remain governed by the runtime's existing explicit configuration.
- This setup does not perform a production build, production database migration, Android/Termux soak, browser/Live2D end-to-end validation, or Release ZIP refresh.

## Smoke validation

The `local-compose-smoke` GitHub Actions workflow validates the Compose configuration, builds and starts both real services, waits for runtime readiness, and probes the app, runtime health endpoint, and the app-to-runtime proxy. If the smoke fails, it collects container logs before tearing down the test stack and its ephemeral volume.
