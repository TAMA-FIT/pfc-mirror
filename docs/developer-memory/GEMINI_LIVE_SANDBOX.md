# Gemini Live Sandbox Memory

## Status

Gemini Live is being developed **outside the production runtime first** in a chat-local ZIP workbench.

Current workbench artifact: `pfc-mirror-gemini-live-sandbox-v0.2.zip`.

This sandbox is not production code and must not be treated as deployed merely because its design/tests pass locally. If the ZIP is unavailable in a future chat, reconstruct it from this memory plus Fresh GitHub state rather than guessing.

## API/model direction

The user's quota/model list included these Live API entries:

- Gemini 2.5 Flash Native Audio Dialog — Live API — RPM unlimited / TPM 1M / RPD unlimited
- Gemini 3 Flash Live — Live API — RPM unlimited / TPM 65K / RPD unlimited
- Gemini 3.5 Live Translate — Live API
- Gemini 3.5 Transcribe / Transcribe Live — transcription-oriented Live API entries

Current first candidate for PFC Mirror conversational Live mode: **Gemini 3 Flash Live**.

Do not infer the exact API model identifier from the UI display name. Verify current Google API documentation/model identifiers immediately before real API wiring.

## Desired Live UX

The existing app's visible conversation-like flow is not a genuine persistent Live session. Desired behavior:

1. User starts Live mode once.
2. A real-time session remains open across multiple turns.
3. The model opens with a short line: **「何を食べましたか？」**
4. A normal pause ends an utterance/turn, not the session.
5. Gemini talks naturally and asks only for information it still needs.
6. Food candidate cards update while the conversation continues.
7. Natural corrections such as 「それぞれ200g」「皮ありだった」「納豆やっぱ消して」 update the same semantic items rather than creating duplicates.
8. Registration is always an explicit user action.
9. Session ends by explicit End or a defined lifecycle/timeout/fatal condition.

## Core architecture invariant

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

Live AI may understand food names, quantities, units, conversational references, corrections, additions/removals and short replies.

Live AI must **not** author P/F/C/A/kcal, authoritative Food IDs, or nutrition database values.

AI stays flexible; nutrition truth stays mechanical.

## Critical v0.2 product decision: do NOT create a generic qualifier rules engine

The user explicitly rejected a generalized system such as `requiredQualifiers` for every food. Reason: the rule set could grow without bound and progressively remove the advantage of using a capable language model.

Therefore:

- Do **not** create a generic per-food attribute/qualifier framework at this stage.
- Let Gemini Live handle ordinary conversational interpretation flexibly.
- Add narrow explicit product exceptions only when real usage proves they are necessary.

### First and currently only explicit exception: chicken breast

Current PFC Mirror tends to surface chicken breast as skinless even when the user did not say skinless. Live mode must not do that.

For semantic chicken breast only (`鶏胸`, `鶏胸肉`, `鶏むね`, etc.):

- never silently default to `skin-off`
- if skin status is unknown, keep it unknown
- candidate UI must not claim `皮なし`
- Live should naturally ask whether it was skin-on or skin-off
- if amount is also missing, Live should preferably ask both in one short turn
- once the user says `皮あり` / `皮なし`, update the same item

This is intentionally **not** a generic meat rule. Beef and unrelated foods must not inherit a skin question.

## Example target conversation

```text
Live: 何を食べましたか？

User: 今日は鶏胸と納豆と米食いました
Live: 鶏胸と納豆とご飯ですね。鶏胸は皮あり・皮なしのどちらでしたか？ あと、お肉とご飯はどれくらいでした？

Draft:
- 鶏胸肉 — skin unknown, amount unknown
- 納豆 — semantic item present
- 米 — amount unknown

User: 肉と米はそれぞれ200gです。鶏胸は皮ありです
Live: 鶏胸は皮ありで200g、ご飯も200gですね。

Draft:
- 鶏胸肉 — skin-on, 200g
- 納豆
- 米 — 200g

User: 納豆やっぱ消して
Live: 納豆は外しました。
```

## Sandbox v0.2 executable pieces

The v0.2 ZIP extends v0.1 with:

- `live/chicken-breast-exception.js`
  - deliberately narrow chicken-breast-only guard
  - prevents implicit skinless default
  - emits only an internal conversational hint; it is not a generalized food rules engine
- `live/conversation-controller.js`
  - defines opening utterance `何を食べましたか？`
  - applies semantic patches and the chicken-breast exception
- updated `live/mock-live-client.js`
  - returns an opening model utterance at connect time for local testing
- additional regression tests

The semantic contract also forbids model-authored internal fields such as `chickenBreastSkinPending`, in addition to P/F/C/A/kcal/Food ID.

## v0.2 local tests

Current network-free test suite passed with exit code 0:

- `session-machine.test.mjs` — PASS
- `semantic-contract.test.mjs` — PASS
- `chicken-breast-exception.test.mjs` — PASS
- `conversation-scenarios.test.mjs` — PASS

The tests currently prove only sandbox state/contract behavior. They do **not** prove real Gemini Live, microphone, WebSocket, Android Chrome or production-runtime behavior.

## Still open before real Live API wiring

- exact current Gemini Live API model identifier
- authentication/ephemeral credential strategy appropriate for a public web app
- exact Function Calling/tool schema
- patch vs full-snapshot semantic event contract
- barge-in/interruption behavior
- idle timeout and grace prompt timing
- pagehide/background behavior
- reconnect/session resumption
- network failure UX
- registration-after-success session behavior
- Android microphone lifecycle

## Existing normal-voice issue remains separate

The user previously reported that normal voice input could capture a transcript such as `鶏胸肉と米と納豆` but leave the memo empty/non-registerable. Read-only inspection showed the existing voice/AI source itself had not simply been replaced by v1.6 code; the current pipeline still contains mechanical pre/post constraints around the model.

Do not solve the normal-voice issue merely by piling on regex rules. Preserve the intended division:

`flexible semantic AI -> deterministic Food Resolver -> Food ID -> Food Master`

Also do not modify the current normal voice-input path merely to build Live. Treat Live as a separate architecture until integration is explicitly approved.

## Resume instruction

When continuing this work from a new chat:

1. Read `docs/developer-memory/README.md`, `CURRENT_STATE.md`, `DEVELOPMENT_PROTOCOL.md`, then this file.
2. Fetch Fresh GitHub `main`; Fresh code/version state wins over remembered SHA/version values.
3. Continue/recreate the isolated Live sandbox first.
4. Preserve the chicken-breast-only exception and avoid introducing a generalized qualifier rules framework without explicit user agreement.
5. Expand mock/state tests before real API wiring.
6. Connect the real Gemini Live API only after the contract/state behavior is stable.
7. Build production integration only against a new Fresh GitHub snapshot, then branch -> diff/PR -> real-device review -> main merge.
