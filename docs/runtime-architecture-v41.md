# PFC Mirror Runtime Architecture — V41 Rebuild

Date: 2026-09-04
Status: Active design record

## Why this rebuild exists

The previous V39/V40 delivery path kept `legacy-index.html` (V35) inside the live boot sequence. `index.html` fetched the old page, rewrote the visible version string, and then injected newer AI/Senior/Voice scripts. That made V35 an active fallback whether or not we intended it to be. Any failure in service-worker state, cache state, dynamic injection, script ordering, or boot code could expose the old UI again.

The key lesson is that rollback assets must not participate in normal execution.

## V41 design rule

There is exactly one active runtime path.

```text
index.html
  -> base application shell / core app scripts
  -> recovered V6 Food Master engine
  -> AI V2
  -> Senior UI V4
  -> Voice Modes V5/V6
```

No live code fetches `legacy-index.html`. No runtime says "if latest fails, load V35". If the current runtime fails, it fails closed with an explicit V41 error instead of silently changing product versions.

## Rollback policy

Rollback remains possible through Git history, commits, branches, and archived implementation files. It is an operator action, never a browser-side automatic action.

The recovered V6 loader is retained as `pfc-v6-loader-recovered.js` because Food Master / Meal Engine V50 depend on that recovered engine. It is a dependency archive, not a UI rollback route.

## Service worker policy

V41 does not use a service worker for HTML/runtime delivery. The old worker architecture caused stale UI to become authoritative on client devices. `sw.js` is now only a retirement shim: it clears old caches, unregisters itself, and has no fetch handler.

The network/GitHub Pages deployment is canonical for application code. User meal data remains in browser storage and is not cleared by runtime updates.

## Version policy

The active runtime owns the version label. V41 paints `V41 VOICE` immediately and keeps it authoritative if older shell code redraws the header.

The header reload action only retires old workers/caches and reloads the current V41 URL with a cache-busting build parameter. It never selects a previous release.

## Failure policy

Current boot succeeds -> application runs.

Current boot fails -> visible `V41 VOICE ERROR` state with a retry instruction.

Current boot fails -> V35 is NOT loaded.

## Storage policy

Do not clear localStorage/meal records during code updates. Cache and service-worker retirement are independent from application data storage.

## V41 acceptance checks

1. Opening `/pfc-mirror/` does not request `legacy-index.html`.
2. Reload cannot intentionally route to V35.
3. No active service worker has a fetch handler for the app.
4. Version label reaches `V41 VOICE` after boot.
5. `window.__PFC_ACTIVE_RUNTIME__.legacyFallback === false`.
6. `window.__PFC_V6_RECOVERY__` is present before AI/Senior/Voice layers load.
7. Existing meal/localStorage data survives reload.
8. Header reload remains on the current runtime.

## Operational note

Do not reintroduce old UI versions into the active browser boot graph for convenience. If a rollback is required, perform it at source-control/deployment level and make that version the new explicit active release.
