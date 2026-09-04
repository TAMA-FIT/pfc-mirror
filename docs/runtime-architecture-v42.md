# PFC Mirror Runtime Architecture — V42 Isolated Rebuild

Date: 2026-09-04
Status: Active canonical deployment design

## Incident root cause

The V41 source deployment was successful, but the published `index.html` still contained the literal V35 shell and referenced the historical filename `pfc-v6-loader.js?v=600`. A previously installed service worker used `caches.match(request, { ignoreSearch: true })` for non-navigation assets. Therefore changing a query string did not bypass its cache: the browser could receive the old cached `pfc-v6-loader.js`, so V41 bootstrap code never ran and the visible app stayed V35.

The same historical service worker also injected AI/Senior/Voice script tags into HTML navigations when their filenames were absent. This made old runtime layers capable of contaminating new HTML even when the network served a newer page.

## V42 architecture

V42 does not reuse any cache-sensitive active asset URL from V35/V39.

```text
/pfc-mirror/                 root upgrade gate only
  -> unregister legacy /pfc-mirror/ service workers
  -> delete legacy runtime caches
  -> redirect to /pfc-mirror/v42/

/pfc-mirror/v42/             isolated active application
  -> V42 loader HTML
  -> unique /v42/* asset paths
  -> recovered Food Master / Meal Engine V50
  -> AI V2
  -> Senior UI V4
  -> Voice Modes V5/V6
```

Every `/v42/` asset path is new. A legacy cache containing `/pfc-mirror/app.js` or `/pfc-mirror/pfc-v6-loader.js` cannot satisfy a request for `/pfc-mirror/v42/app.js` or `/pfc-mirror/v42/runtime-v42.js`, even when the old worker uses `ignoreSearch: true`.

The V42 loader reads an inert copy of the previous application shell from `/v42/shell-source.html`, rewrites its active asset references to the isolated `/v42/` paths before execution, and never executes the historical `pfc-v6-loader.js` path.

## Legacy service-worker injection guard

The V42 entry HTML contains a non-executable comment naming the old injected filenames. Historical service-worker code checked only whether those filename strings existed in HTML before injecting script tags. The guard makes that old injector a no-op while V42 loads its own isolated files.

## Rollback policy

Rollback exists only in Git history / branches / explicit source deployment. No browser runtime automatically loads V35, V39, or V41. Old UI assets are not a fallback target.

## Failure policy

- V42 succeeds: run V42.
- V42 fails: show `V42 VOICE ERROR`.
- V42 fails: never load V35.

## Storage policy

Runtime cleanup deletes service-worker caches only. It does not clear `localStorage`, so meal records and existing user data stay on the same `tama-fit.github.io` origin and remain available across `/pfc-mirror/` and `/pfc-mirror/v42/`.

## Acceptance checks

1. Root `/pfc-mirror/` contains no application shell; it only cleans legacy runtime state and enters `/v42/`.
2. `/pfc-mirror/v42/` displays `V42 VOICE`, not V35.
3. V42 active assets use `/pfc-mirror/v42/*` paths, not old cache-sensitive root filenames.
4. `runtime-v42.js` is a brand-new filename and is not present in any historical V35/V39 app shell cache.
5. Historical HTML injection sees its guard strings and does not append old AI/Senior/Voice scripts.
6. `window.__PFC_ACTIVE_RUNTIME__.legacyFallback === false`.
7. Food Master recovery completes before current AI/Senior/Voice layers are started.
8. Header refresh stays in `/pfc-mirror/v42/`.
9. localStorage meal data survives the migration.

## Operational rule

Future builds should use versioned active directories or immutable build filenames. Do not rely on query-string cache busting for a path that any historical service worker cached with `ignoreSearch: true`.
