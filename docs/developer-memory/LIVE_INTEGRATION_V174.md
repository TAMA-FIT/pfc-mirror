# Live Integration v1.7.4

## Purpose

Pair the existing GAS V12 Live Token endpoint with a browser request shape that matches the already-working normal AI GAS transport as closely as possible.

## Change

Only the Live token fetch path changes:

- `Content-Type: text/plain`
- remove `Accept: application/json`
- remove `cache: no-store`
- explicitly use `redirect: follow`
- keep `taskType: liveToken`

The public app version is bumped to `v1.7.4` so device testing can distinguish the new runtime from cached or older builds.

## Protected runtime

Do not change for this diagnostic step:

- normal voice input
- normal AI flow
- Food Master / deterministic nutrition resolver
- storage
- GAS V12 implementation

## Expected device signals

After the public app shows `v1.7.4` and GAS V12 is deployed, starting Live should do one of the following:

1. show GAS V12 diagnostic data (`PFC_GAS_LIVE_TOKEN_V12`, phase/status), or
2. advance to WebSocket/setup diagnostics.

If the browser still reports `Failed to fetch` before any GAS diagnostic appears, investigate Apps Script redirect/CORS behavior independently from Gemini Live itself.
