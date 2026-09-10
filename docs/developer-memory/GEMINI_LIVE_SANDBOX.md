# Gemini Live Sandbox Memory

## Status

Gemini Live is being developed outside the production runtime first in a chat-local ZIP workbench.

Current workbench artifact: `pfc-mirror-gemini-live-sandbox-v0.4.zip`.

The sandbox is not deployed production code. Local tests do not prove real Gemini Live, microphone, WebSocket, Android Chrome, or production-runtime behavior.

If a future chat cannot access the ZIP, reconstruct the workbench from this memory plus Fresh GitHub state rather than guessing.

## Mandatory resume rule

A future development chat must first read:

1. `docs/developer-memory/README.md`
2. `docs/developer-memory/CURRENT_STATE.md`
3. `docs/developer-memory/DEVELOPMENT_PROTOCOL.md`
4. this file
5. then fetch Fresh GitHub `main`

Fresh GitHub wins for code/version state. This memory wins for agreed design/process intent unless the user explicitly changes it.

## Model direction

The user's API quota/model list includes a Live API entry displayed as `Gemini 3 Flash Live` and this is the first candidate for PFC Mirror Live conversation mode.

Do not infer the exact API model identifier from that UI display name. Verify current Google API documentation immediately before real API wiring.

Google's current Live API documentation confirms Function Calling is supported. Current Gemini 3.x Flash Live documentation describes synchronous Function Calling, so PFC Mirror's draft-update tool is intentionally designed to be very small and fast; resolver work is started independently rather than making the model wait for nutrition resolution.

## Desired Live UX

- User starts Live once.
- Real-time session stays open across multiple turns.
- Opening model utterance is short: `何を食べましたか？`
- Normal silence ends a speech turn, not the Live session.
- Model speaks naturally and decides ordinary acknowledgement/question wording.
- Food cards appear/update during conversation.
- Natural corrections such as `それぞれ200g`, `ごめん鶏ももだった`, `米200じゃなくて150`, `納豆やっぱ消して` update the same draft items.
- Final registration is always an explicit user action.
- Session termination/timeout/VAD details remain to be real-device tuned.

## Architecture invariant

```text
microphone audio
  -> Gemini Live semantic conversation
  -> update_meal_draft Function Call
  -> semantic draft validator/store
  -> immediate UI card update
  -> background deterministic Food Resolver
  -> trusted Food ID
  -> Food Master
  -> nutrition engine
  -> explicit Register
```

Gemini Live may interpret:

- food names
- quantities and units
- conversational references
- additions
- corrections
- deletions
- semantic variants/qualifiers the user actually meant
- short natural replies

Gemini Live must not author:

- P/F/C/A
- kcal/calories
- authoritative Food IDs
- nutrition values
- database/source truth

## Conversation policy

Do not hard-code detailed conversation scripts or per-food question sequences.

App code controls only the hard boundaries: session lifecycle, VAD settings, the semantic Function Calling contract, the chicken-breast exception, trusted Food Resolver/nutrition truth, and explicit registration.

Gemini controls ordinary conversational behavior: wording, acknowledgement, question order, how to combine questions, and natural interpretation of references/corrections.

This boundary is deliberate. Do not replace model intelligence with an expanding regex/rule system.

## Critical product decision: no generic qualifier rules engine

Do not create a generalized `requiredQualifiers` system for every food. The user explicitly rejected this because it can grow without bound and progressively destroy the benefit of using a capable language model.

Add narrow explicit product exceptions only when real testing proves they are needed.

### First and currently only explicit exception: chicken breast

For semantic chicken breast (`鶏胸`, `鶏胸肉`, `鶏むね`, etc.):

- never silently default to skinless in Live mode
- if skin status is unknown, keep it unknown
- candidate UI must not claim skinless
- Live should naturally ask skin-on vs skin-off when needed
- if amount is also missing, Live may combine those questions naturally
- once stated, update the same item/card

This rule must not spread to beef or unrelated foods.

The current normal-path resolver's bare chicken alias to skinless remains untouched; Live bypasses that default until skin is semantically known.

## Immediate background Food Resolver behavior

Start trusted Food Resolver work as soon as a semantic card appears. Do not wait for quantity.

Example:

```text
semantic card: 米 / amount unknown
-> card appears immediately
-> resolveFood("米") starts immediately
-> trusted 白米 identity can be ready before quantity arrives
-> later amount=200g only triggers mechanical scaling
```

Re-resolve only when identity-affecting fields currently change (`name` or `variant`). Amount-only changes reuse the existing trusted Food ID.

Every resolve operation is revisioned. If the user corrects a food while an old lookup is still in flight, the late old result is stale and must never overwrite the newer identity.

## Formal Function Calling contract — sandbox v0.4

Use exactly one custom function:

`update_meal_draft`

Do not split it into many micro-tools such as `addFood`, `changeAmount`, `deleteFood`.

### Input

The function receives a batch of semantic operations:

```json
{
  "operations": [
    {
      "op": "add | update | remove",
      "ref": "app-issued ref for update/remove only",
      "name": "semantic food name",
      "amount": 200,
      "unit": "g",
      "variant": "skin-on"
    }
  ]
}
```

Rules:

- `add`: `name` required, `ref` forbidden
- `update`: app-issued `ref` required; only changed semantic fields need to be sent
- `remove`: app-issued `ref` required
- nutrition/Food-ID/database fields are rejected

### Stable refs are app-owned

Gemini does not invent persistent card IDs.

Example:

1. Gemini adds `鶏胸肉`
2. app creates and returns `ref=item-1`
3. user says `ごめん、鶏ももだった`
4. Gemini updates `ref=item-1`
5. same card changes identity; no duplicate is created

When food identity changes and Gemini does not explicitly provide a replacement variant, the draft store clears the old variant so `skin-on` cannot leak from chicken breast into another food.

### Tool response

The app returns semantic draft state and the app-issued refs, for example:

```json
{
  "ok": true,
  "revision": 1,
  "applied": [
    {"operationIndex": 0, "op": "add", "ref": "item-1"}
  ],
  "draft": [
    {
      "ref": "item-1",
      "name": "鶏胸肉",
      "amount": null,
      "unit": "",
      "variant": "",
      "chickenBreastSkinPending": true
    }
  ],
  "notices": [
    {"code": "CHICKEN_BREAST_SKIN_UNCONFIRMED", "message": "..."}
  ]
}
```

The response intentionally does not expose Food ID or nutrition/macros back to Live.

Accepted draft mutations trigger resolver synchronization immediately, but the tool does not need to wait for resolver completion before returning to Gemini.

## Sandbox executable pieces through v0.4

Core pieces include:

- `live/session-machine.js`
- `live/contracts.js`
- `live/mock-live-client.js`
- `live/conversation-controller.js`
- `live/chicken-breast-exception.js`
- `live/resolver-coordinator.js`
- `live/draft-resolution-bridge.js`
- `live/update-meal-draft-tool.js`
- `live/update-meal-draft-contract.js`
- `live/meal-draft-store.js`
- `live/update-meal-draft-handler.js`
- `live/gemini-tool-call-adapter.js`

The Gemini adapter follows the Live API shape conceptually:

`toolCall.functionCalls[] -> local handler -> functionResponses[]`

## Sandbox v0.4 tests

Network-free suite currently passes with exit code 0:

- `session-machine.test.mjs`
- `semantic-contract.test.mjs`
- `chicken-breast-exception.test.mjs`
- `conversation-scenarios.test.mjs`
- `resolver-coordinator.test.mjs`
- `stale-resolution.test.mjs`
- `draft-resolution-bridge.test.mjs`
- `function-contract.test.mjs`
- `function-handler.test.mjs`
- `gemini-tool-call-adapter.test.mjs`
- `function-conversation-flow.test.mjs`

The tests currently cover:

- session survives ordinary pause
- chicken breast does not default to skinless
- no generic meat-skin rule
- resolver begins before amount is known
- amount-only update does not re-resolve identity
- stale async resolver result cannot overwrite a later correction
- add cannot invent its own ref
- update/remove require app-issued ref
- Food ID/PFC/kcal/nutrition fields are rejected from model input
- app generates stable refs
- same card survives food correction
- old variant is cleared on identity change
- batch add/update/remove works
- tool response does not leak Food ID/macros
- Gemini `toolCall.functionCalls[]` adapts to `functionResponses[]`
- unknown tool fails safely

## Existing normal voice path remains separate

Do not rewrite current `clean/src/voice/input.js` merely to build Live.

A separate normal voice/AI issue was observed where a transcript such as `鶏胸肉と米と納豆` could remain in a dead-end empty memo state. Source inspection showed that v1.6 did not simply replace the voice/AI files. Do not solve that issue by piling on regex rules. Preserve the intended architecture:

`flexible semantic AI -> deterministic Food Resolver -> trusted Food ID -> Food Master`

## Still open before real Live wiring

- exact current API model identifier corresponding to the user's displayed `Gemini 3 Flash Live`
- public-web authentication / ephemeral-token strategy
- exact SDK vs raw-WebSocket implementation path
- VAD/end-of-turn tuning
- barge-in/interruption behavior
- idle timeout and grace timing
- pagehide/background behavior
- reconnect/session resumption
- network-failure UX
- whether Live remains open after successful registration
- Android Chrome microphone lifecycle
- actual function-declaration compatibility test against the real Live API

## Next development step

Do not integrate production yet.

Next logical sandbox phase is to build the real Live transport boundary behind an interface while keeping a mock transport, then verify the exact current Gemini model identifier/authentication requirements and perform a minimal real API handshake/tool-call experiment. Only after that should the Live transport be connected to microphone/audio and existing UI.

Production integration must later start from a new Fresh GitHub snapshot and follow branch -> diff/PR -> real-device review -> main merge.
