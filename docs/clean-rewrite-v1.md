# PFC Clean Rewrite v1

Date: 2026-09-04
Status: Active architecture

## Decision

The old overlay runtime is retired. The active application is rebuilt as a normal static web app with explicit ES modules. Legacy V35/V6/Senior/Voice runtime code is not executed by the clean app.

## Active route

```text
/pfc-mirror/
  -> one-time cache/service-worker retirement gateway
  -> /pfc-mirror/clean/
      -> static index.html
      -> ES modules
         storage.js
         nutrition/catalog.js
         nutrition/engine.js
         ai/client.js
         voice/input.js
         main.js
```

There is no runtime HTML transformation, document.write, eval, dynamic script injection, browser-side rollback, or Service Worker application shell.

## Data migration

The clean runtime intentionally preserves the established localStorage keys for user data:

- tf_dat
- tf_tg
- tf_fav
- tf_fav_settings
- tf_my
- tf_hist
- tf_body

Old records are normalized on read. New records use the same top-level P/F/C/A/Cal/N/U/time shape plus `_clean` metadata for deterministic recalculation.

## Food Master migration

The clean runtime does not boot the recovered compressed V6 runtime. Instead, the recovered assets were treated as source material during the rewrite:

- 408 base food rows were converted to a data-only ES module.
- 46 verified MEXT registry entries were extracted to a data-only ES module.
- MEXT values override matching base foods at build/source level.
- Nutrition scaling, unit parsing, search, record building, and edit recalculation were rewritten as normal modules.

This removes the gzip -> SHA -> eval boot chain from production runtime.

## Voice/AI policy

Three UX modes remain:

- 音声入力
- 会話
- おまかせ

All three share one microphone implementation. Browser SpeechRecognition is currently the transcription adapter; it can later be replaced by Gemini Transcribe Live without changing the rest of the app architecture.

Food names are placed into the memo as soon as they can be resolved. Common single-unit foods may receive a safe default. Quantity-sensitive foods remain unresolved until the user supplies an amount. AI timeouts do not clear the transcript or memo.

## Deployment policy

Git is the rollback system. The browser is not.

A failed current release must be fixed or rolled back at source/deployment level. Old UI code must never be loaded automatically by the client.

Service Worker remains disabled until there is a concrete offline requirement and a new cache strategy has dedicated tests.

## Acceptance criteria

1. `/clean/` loads without legacy scripts.
2. No request for `app.js`, `ai-v2.js`, `senior-v4.js`, `pfc-v6-loader.js`, or voice overlay files from the old root runtime.
3. No `document.write` or `eval` in the clean runtime.
4. No service worker registration.
5. Existing `tf_dat` and related data are readable.
6. New Food Master records can be added, edited, deleted and persisted.
7. Reload produces the same current UI, not an earlier version.
8. Voice memo state is not destroyed by AI failure.
