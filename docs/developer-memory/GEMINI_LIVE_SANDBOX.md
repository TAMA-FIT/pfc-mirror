# Gemini Live Sandbox Memory

## Status

A chat-local workbench ZIP was created before production implementation:

`pfc-mirror-gemini-live-sandbox-v0.1.zip`

It was intentionally **not pushed to production runtime**. Its purpose is to let future sessions refine and test the Live architecture in isolation before integration.

If the original chat ZIP is unavailable in a future session, recreate it from this document and the current code instead of guessing.

## API models observed in the user's current API quota list

Relevant Live API entries supplied by the user:

- Gemini 2.5 Flash Native Audio Dialog — Live API — RPM unlimited / TPM 1M / RPD unlimited
- Gemini 3 Flash Live — Live API — RPM unlimited / TPM 65K / RPD unlimited
- Gemini 3.5 Live Translate — Live API — RPM unlimited / TPM 20K / RPD unlimited
- Gemini 3.5 Transcribe — Live API — RPM 3 / TPM 10K / RPD 25
- Gemini 3.5 Transcribe Live — Live API — RPM unlimited / TPM 20K / RPD unlimited

Current intended first candidate for PFC Mirror real-time conversation: **Gemini 3 Flash Live**.

Do not infer the exact API model identifier from this display name. Verify the current Google API model identifier/documentation at implementation time.

## Why Live is being added

The existing app's visible “conversation” style is not a genuine persistent Live session. The desired UX is closer to a normal voice conversation:

1. User starts Live mode once.
2. A real-time session remains active.
3. Pauses end an utterance/turn, **not** the whole session.
4. Gemini can speak naturally and ask only for missing information.
5. Candidate food cards update while conversation continues.
6. User can naturally correct the draft.
7. User explicitly confirms registration.
8. Session ends when user presses End or a defined lifecycle/safety condition closes it.

Example target conversation:

```text
User: 今日は鶏胸と納豆と米食いました
Live: 鶏胸と納豆とご飯ですね。お肉とご飯はどれくらいでした？

Draft:
- 鶏胸肉 — amount unknown
- 納豆 — semantic item present
- 米 — amount unknown

User: 肉と米はそれぞれ200gです。あ、肉は皮ありです
Live: 鶏胸は皮あり、鶏胸とご飯は200gずつですね。

Draft updates the same stable references instead of creating duplicates.
```

## Core architecture decision

The project must preserve this boundary:

```text
microphone audio
  -> Gemini Live semantic conversation
  -> semantic meal draft / tool events
  -> deterministic Food Resolver
  -> trusted Food ID
  -> Food Master
  -> nutrition engine
  -> UI cards
  -> explicit Register
```

### Live AI may determine

- food name / semantic identity
- amount
- unit
- meal timing
- variant or qualifier (e.g. skin-on)
- add / update / remove intent
- references such as “それ”, “さっきの肉”, “それぞれ200g”
- short conversational response

### Live AI must not author

- P
- F
- C
- A
- kcal
- authoritative Food ID
- nutrition database values

The reason is deliberate: **AI stays flexible; nutrition truth stays mechanical.**

## Local sandbox v0.1 structure

The original ZIP contained approximately:

```text
pfc-mirror-gemini-live-sandbox-v0.1/
├─ README.md
├─ BASELINE.md
├─ RUN_TESTS.md
├─ TEST_RESULTS.txt
├─ package.json
├─ docs/
│  ├─ API_MODEL_LIST.md
│  ├─ SPEC_DRAFT.md
│  ├─ DECISIONS.md
│  ├─ ARCHITECTURE.md
│  ├─ TEST_MATRIX.md
│  └─ SCENARIOS.md
├─ source-map/
│  └─ CURRENT_RUNTIME.md
├─ live/
│  ├─ contracts.js
│  ├─ draft-reducer.js
│  ├─ session-machine.js
│  └─ mock-live-client.js
└─ tests/
   ├─ session-machine.test.mjs
   ├─ semantic-contract.test.mjs
   └─ conversation-scenarios.test.mjs
```

## v0.1 tests already passed

Local/network-free tests completed with exit code 0:

- `session-machine.test.mjs` — PASS
- `semantic-contract.test.mjs` — PASS
- `conversation-scenarios.test.mjs` — PASS

The scripted conversation tested:

- add chicken/natto/rice
- later set chicken and rice to 200g
- later correct the same chicken item to `skin-on`
- preserve stable item references
- forbid semantic payload fields such as P/F/C/A/kcal/Food ID
- normal pause does not end session
- explicit stop does end session

## Open design decisions before real implementation

Do not wire the real Live API until these are decided/tested:

- exact Gemini Live API model identifier
- exact function/tool schema
- semantic event form: full snapshot vs patches
- barge-in/interruption behavior
- whether model audio can always be interrupted
- session idle timeout
- “still there?” grace timeout
- pagehide/background policy
- reconnect/session-resumption policy
- network failure UX
- whether successful meal registration keeps the same Live session open
- maximum practical session duration for PFC use

## Important normal-voice issue currently open

After v1.6.1, the user reported a normal voice-input failure using speech similar to:

`鶏胸肉と米と納豆`

Observed UI:

- transcript was captured
- food memo stayed empty
- UI remained in a non-registerable “聞き取り中” state
- no useful AI conversational response appeared

Read-only investigation established:

- `clean/src/voice/input.js` matched the previously working v1.5.1 blob
- the normal AI entrypoint also remained on the existing path
- the current semantic pipeline contains mechanical pre/post constraints around the model, including local optimistic parsing and trusted Food-ID candidate gating

Do **not** treat “add a regex for と” as the final architectural fix. The more important intended correction is to restore the division:

`flexible semantic AI -> deterministic Food Resolver -> Food ID -> Food Master`

The normal voice bug remains an open issue until an actual candidate is tested and device-verified.

## Resume instruction

When the user says to continue Live development:

1. Read this file and `DEVELOPMENT_PROTOCOL.md`.
2. Fetch Fresh `main`.
3. Do not modify the current normal voice implementation just to build Live.
4. Recreate/continue the isolated sandbox.
5. Expand mock conversations before real API wiring.
6. Only after mock/state contracts are stable, connect a real Gemini Live session.
7. Only after real Live tests pass, build a separate production integration branch.
