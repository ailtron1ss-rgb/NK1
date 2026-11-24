# Hexis source provenance and sanitization

Source: `Hexis-main.zip`, inspected 2026-10-08.

This copy is retained for provenance and code comparison. Runtime credentials and machine-local configuration were intentionally excluded from the integrated archive:

- `.env.local`
- `core/auth/gmail-credentials.json`
- dependency/build/cache directories

No credential values are copied into the Neuro-Kurisu SUPER release artifact. Provider integrations must obtain secrets from the canonical Neuro-Kurisu secret/configuration boundary.
