# Gemini Live Sandbox Memory

## Status

Gemini Live is being developed **outside the production runtime first** in a chat-local ZIP workbench.

Current workbench artifact: `pfc-mirror-gemini-live-sandbox-v0.3.zip`.

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

## Critical product decision: do NOT create a generic qualifier rules engine

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

## Conversation policy

Do not hard-code detailed conversation scripts or per-food question sequences. Gemini Live should decide ordinary phrasing, acknowledgements, question order, contextual references and corrections.

App-controlled boundaries:

- opening line
- VAD / end-of-turn timing
- explicit chicken-breast exception
- semantic draft contract
- Food Resolver and nutrition truth
- explicit registration
- session lifecycle / timeout / failure behavior

Gemini-controlled behavior:

- natural acknowledgements
- whether to ask immediately or after a short conversational acknowledgement
- how to combine missing-information questions
- contextual interpretation such as 「それぞれ200g」「さっきの肉」「ごめん、鶏ももだった」「米200じゃなくて150」

This boundary is deliberate: do not replace model intelligence with an expanding regex/rule system.

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

## Sandbox v0.3 executable pieces

The v0.3 ZIP extends the prior workbench with:

- `live/chicken-breast-exception.js`
  - deliberately narrow chicken-breast-only guard
  - prevents implicit skinless default
- `live/conversation-controller.js`
  - defines opening utterance `何を食べましたか？`
  - applies semantic patches and the chicken-breast exception
- `live/mock-live-client.js`
  - scripted conversational testing without network/API calls
- `live/resolver-coordinator.js`
  - starts trusted Food ID resolution as soon as a semantic card appears
  - does not wait for amount
  - reuses Food ID across amount-only changes
  - re-resolves identity only when semantic name/variant changes
  - uses per-card revision numbers so stale async results cannot overwrite later corrections
  - deliberately blocks bare chicken breast from falling into the existing skinless default
- `live/draft-resolution-bridge.js`
  - connects semantic draft changes to background resolution
  - supports immediate card rendering while resolution proceeds independently

The semantic contract forbids model-authored P/F/C/A/kcal/Food ID and internal app-only fields.

## Background resolver timing decision

As soon as Gemini Live emits a semantic food card, the UI may show that card immediately and the trusted Food Resolver should start in parallel.

Do not wait for quantity before resolving identity.

Example:

```text
Live semantic event: 米, amount unknown
  -> UI card appears immediately
  -> resolveFood("米") runs immediately
  -> trusted 白米 Food ID can be cached before the user says 200g
  -> later amount=200g only triggers mechanical nutrition scaling
```

Identity-affecting corrections cause a new resolver revision:

```text
r1: 鶏胸 lookup starts
user: 「ごめん、鶏ももだった」
r2: 鶏もも lookup starts
r2 resolves and becomes current
late r1 result arrives -> stale -> ignored
```

This protects Live UX from race-condition regressions.

For bare chicken breast, the resolver must **not** use the current application's default alias that maps bare 鶏むね/鶏胸 to skinless. In Live mode it remains semantically pending until skin-on/skin-off is known.

## v0.3 local tests

Current network-free suite passed with exit code 0:

- `session-machine.test.mjs` — PASS
- `semantic-contract.test.mjs` — PASS
- `chicken-breast-exception.test.mjs` — PASS
- `conversation-scenarios.test.mjs` — PASS
- `resolver-coordinator.test.mjs` — PASS
- `stale-resolution.test.mjs` — PASS
- `draft-resolution-bridge.test.mjs` — PASS

These tests prove sandbox state/contract behavior only. They do **not** prove real Gemini Live, microphone, WebSocket, Android Chrome or production-runtime behavior.

## Existing trusted resolver facts relevant to Live

The current production `clean/src/nutrition/catalog.js` already separates trusted automatic resolution from fuzzy UI search. `resolveFood()` accepts only explicit app defaults, exact canonical names, or unique exact aliases. Fuzzy `searchFoods()` must not become nutrition truth.

The current production alias table maps bare chicken breast names such as `鶏胸肉` to `鶏むね(皮なし)`. That behavior remains valid for the current normal path but must be bypassed by the Live chicken-breast exception until the user supplies skin status.

## Still open before real Live API wiring

- exact current Gemini Live API model identifier
- authentication/ephemeral credential strategy appropriate for a public web app
- exact Function Calling/tool schema as sent to the real Gemini Live API
- barge-in/interruption behavior and VAD tuning on real devices
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
5. Preserve the conversation-policy boundary: AI handles natural dialogue; app code handles hard safety/data boundaries.
6. Preserve immediate background trusted resolution with per-card revisions and stale-result rejection.
7. Expand mock/state tests before real API wiring.
8. Connect the real Gemini Live API only after the contract/state behavior is stable.
9. Build production integration only against a new Fresh GitHub snapshot, then branch -> diff/PR -> real-device review -> main merge.
