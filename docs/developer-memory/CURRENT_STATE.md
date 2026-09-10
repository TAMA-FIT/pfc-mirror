# PFC Mirror Current Development State

Last memory refresh: 2026-09-10 JST

## Canonical runtime state

- Production app version displayed by current runtime: **v1.6.1**
- Runtime release merge commit: `81281dd21a2cecc8c1dadfe47672baaf594b6ff9`
- `main` immediately before this current-state memory file was created: `969938060fd4f57ddb3dbaa86d256e9d28d17449`
- This developer-memory write itself advances `main`; future sessions must always fetch Fresh `main` rather than assuming either SHA is still HEAD.

## v1.6.1 release contents

The released senior integration currently includes:

- calorie presets: 1200 / 1600 / 2000 / 2400 kcal
- PFC balance presets: standard / low-fat / muscle gain / keto
- P/F/C target grams derived mechanically from calorie target + energy-ratio mode
- alcohol A display only when alcohol is present
- history A display when relevant
- hidden developer Manager Mode / decoy tools
- v1.6.1 observer/dummy-cleanup stability fixes

Current normal voice/AI/Food-ID architecture was intentionally preserved during the v1.6.1 stability release.

## Relevant release history

- PR #23 — `Senior PFC workbench round 2`
  - still open as Draft at this memory refresh
  - design/workbench only
  - old v1.5.1 baseline
  - do not merge blindly; much of its intent has already been integrated by later runtime work

- PR #25 — redundant v1.6 runtime candidate
  - closed without merge after discovering equivalent v1.6.0 implementation had already landed on `main`

- PR #26 — `Stabilize v1.6.1 senior runtime observer and dummy cleanup`
  - merged
  - CI/smoke check passed before merge

## Critical lessons from the v1.6 integration

### Public entrypoint

Root `index.html` is an active entrypoint that directly loads `clean/` runtime assets. Updating only `clean/index.html` is insufficient for the canonical public URL.

### Concurrent-main protection

While a candidate branch was being prepared, `main` moved. The workflow correctly detected this before merge. Future work must repeat this check every time.

### No duplicate implementation layers

If `main` already contains an implementation equivalent to a pending branch, stop and inspect instead of merging both.

## Open bug: normal voice meal memo can fail

The user device reported a failure after speaking content similar to:

`鶏胸肉と米と納豆`

Observed behavior:

- speech transcript appeared
- AI/meal cards did not populate
- UI remained in `聞き取り中`
- no useful conversational answer was returned

Read-only comparison found:

- `clean/src/voice/input.js` remained byte-identical/blob-identical to the prior v1.5.1 implementation
- normal AI entry files also remained on the existing implementation
- the pipeline has mechanical optimistic parsing and trusted-candidate/Food-ID gating around the semantic model

Current conclusion:

Do not assume the model itself is unable to understand ordinary Japanese conjunctions. The architecture is over-constrained around the model. A one-off regex patch for `と` is not the desired final fix.

Desired normal-AI architecture remains:

`flexible semantic interpretation -> deterministic Food Resolver -> trusted Food ID -> Food Master -> mechanical nutrition`

This bug is **not considered device-verified fixed** at this state.

## New planned feature: genuine Gemini Live conversation

The user wants to replace the pseudo-conversation experience with a genuine persistent Live conversation mode.

Current intended model candidate from the user's API quota list:

**Gemini 3 Flash Live**

Desired UX:

- user presses Live start once
- Live session remains active across multiple turns
- normal pauses do not terminate the session
- Gemini speaks naturally
- candidate meal cards update during the conversation
- follow-up questions are conversational and minimal
- natural corrections work (`それぞれ200g`, `皮あり`, `納豆やっぱ消して`)
- nutrition values remain deterministic and outside model authority
- explicit register button remains the final commit action
- explicit End closes the Live session
- idle/network/page lifecycle behavior must be designed before production integration

See `GEMINI_LIVE_SANDBOX.md` for the full sandbox contract.

## Local sandbox already created in the originating chat

Artifact name:

`pfc-mirror-gemini-live-sandbox-v0.1.zip`

It was created from a Fresh runtime snapshot and included:

- specification documents
- architecture/decision/test matrices
- semantic contract validator
- draft reducer
- Live session state machine
- Mock Live client
- scripted conversation tests

Tests passed locally with exit code 0:

- session-machine test
- semantic-contract test
- conversation-scenarios test

No real Gemini Live network connection was wired yet. No production runtime was modified by that sandbox.

## Next recommended development action

If development resumes from here, do **not** start by editing GitHub production files.

Recommended order:

1. Read all files in `docs/developer-memory/`.
2. Fetch Fresh `main` and verify production version/state.
3. Continue/recreate the Gemini Live sandbox locally/chat-side.
4. Finalize the Live session contract:
   - model identifier
   - function/tool schema
   - semantic patch/snapshot format
   - interruption behavior
   - idle timeout
   - reconnect/session resumption
   - page/background lifecycle
   - post-registration session behavior
5. Expand mock scenarios and automated tests.
6. Wire real Gemini Live only after state/semantic tests are stable.
7. Test real audio/session behavior.
8. Create a separate production integration branch from a new Fresh `main`.
9. PR/diff/device review.
10. Merge only after approval.

## Product scope reminders

Keep/rebuild:

- current normal voice input unless specifically fixing its open bug
- flexible AI semantic understanding
- deterministic Food ID/Food Master nutrition
- senior-friendly calorie/PFC presets
- automatic alcohol handling
- manual input fallback
- favorites/quick input
- today's records
- history
- simplified statistics
- body composition
- backup/restore
- hidden developer Manager Mode

Do not restore as ordinary elderly-user features:

- cheat day
- meal gacha / recipe / meal suggestion system
- camera food input
- nutrition-label camera scanner
- body photo album
- rigid old AI command-tag architecture
- visible developer/Manager UI
- huge old local database browser as primary UX

## Final rule

Fresh GitHub is canonical for current code. These memory files are canonical for **intent, constraints, process and handoff**, but must be updated when decisions materially change.
