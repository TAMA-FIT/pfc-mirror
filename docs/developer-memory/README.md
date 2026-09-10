# PFC Mirror Developer Memory

> Canonical developer handoff entrypoint for future ChatGPT/Codex sessions.
>
> This directory is documentation only. Production runtime must never import or depend on it.

## Mandatory startup protocol

When resuming PFC Mirror development from a new chat, **do not treat chat history or remembered version numbers as canonical**.

Start in this order:

1. Read this file.
2. Read `CURRENT_STATE.md`.
3. Read `DEVELOPMENT_PROTOCOL.md`.
4. If working on Gemini Live, also read `GEMINI_LIVE_SANDBOX.md`.
5. Fetch a Fresh GitHub `main` ref and the exact production files relevant to the task.
6. Compare Fresh GitHub state with the state recorded here.
7. If they differ, Fresh GitHub wins for code/version state; update this memory after the work is complete.

## Repository

- Repository: `TAMA-FIT/pfc-mirror`
- Public app entrypoint: root `index.html`
- Active runtime is under `clean/`.
- Root `index.html` directly loads the clean runtime; it is not merely a redirect. Therefore entrypoint/cache-bust changes may need to be made in both root `index.html` and `clean/index.html`.

## Product direction

PFC Mirror is a separate elderly-oriented PFC tracking app. It is not intended to reproduce every feature of the older normal PFC app.

Core direction:

- senior-friendly UI
- minimal feature surface
- natural/flexible AI language understanding
- deterministic Food ID resolution
- Food Master as nutrition authority
- explicit user confirmation before registration
- current voice-input path protected unless a voice issue is explicitly reopened
- future genuine Gemini Live conversation mode developed as a separate architecture

## Non-negotiable architecture invariant

AI may understand intent, food names, quantities, references, corrections and deletions.

AI must **not** be the source of truth for P/F/C/A/kcal.

Target data path:

`natural language / Live conversation -> semantic meal draft -> deterministic Food Resolver -> trusted Food ID -> Food Master -> nutrition engine -> UI -> explicit register`

## Important process rule

Do not jump directly from a reported issue to production edits.

The normal workflow is:

`symptom discussion -> cause separation -> target UX/architecture -> side-effect review -> user agreement -> local/chat sandbox -> automated tests -> review branch -> diff/PR -> device/human review -> main merge`

Read `DEVELOPMENT_PROTOCOL.md` for the exact working method.

## Why this directory exists

This folder is intentionally stored in the same repository so that a future development chat can recover the exact project direction even if a prior conversation disappears or reaches context limits.

Because these are plain documentation files and production code does not import them, they do not add runtime JavaScript, network requests, localStorage work, or app UI cost. They only add a small amount of repository/static-deployment storage.
