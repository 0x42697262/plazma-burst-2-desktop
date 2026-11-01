# 0004. Versioned local files

Date: 2026-11-01. Status: accepted.

## Context
The app keeps state in local JSON files with no version field:
- `desktop/dev-overrides*.json`
- `desktop/servers.json`
- `fingerprint*/index.json`
- `desktop/remote-testers.json`
- `desktop/p2p-host.json`
- `server/server.json`
- `desktop/credentials.json`

The guidelines require that everything persisted carries a version
([principles](../architecture/principles.md) §3.4).

## Decision
- Every such file is `{ "schemaVersion": N, ... }`.
- It is read through `src/kernel/persist/versioned.ts`, which:
  - treats a file with no version as v0;
  - runs the migrations from vN to the latest on read;
  - writes atomically (temporary file, then rename);
  - refuses a version newer than it knows, with a clear error, instead of overwriting
    it.
- Each file gets its version when its feature is migrated (step P3).

## Consequences
- Once a file is migrated, an older checkout of the app refuses it rather than
  silently dropping fields.
