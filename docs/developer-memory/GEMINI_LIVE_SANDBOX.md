# Gemini Live Design / Historical Sandbox Memory

Last refresh: 2026-09-11 JST

## Status

The original chat-local sandbox (`pfc-mirror-gemini-live-sandbox-v0.4.zip`) was the design/proof workbench. Genuine Gemini Live has since been integrated into the production runtime.

Do **not** follow older instructions that say Live must not be integrated yet. Fresh GitHub `main` is canonical for current runtime state. This file preserves design invariants and the path that led to production.

## Mandatory resume rule

A future development chat should first read:

1. `docs/developer-memory/README.md`
2. `docs/developer-memory/CURRENT_STATE.md`
3. `docs/developer-memory/DEVELOPMENT_PROTOCOL.md`
4. this file
5. then fetch Fresh GitHub `main`

Fresh GitHub wins for code/version state. These docs preserve agreed product/architecture intent unless the user explicitly changes it.

## Current model split

### Conversational Live agent

- model: `gemini-3.1-flash-live-preview`
- role: natural spoken conversation, semantic food understanding, Function Calling, spoken response
- current real-device status: working on Android Chrome through `setupComplete`, multi-turn conversation, Function Calling, and draft-card updates

### Dedicated display transcription candidate in v1.7.8

- model: `gemini-3.5-transcribe-live`
- role: user-visible `あなた` transcript only
- language hint: `ja-JP`
- mode: `SMART`
- custom vocabulary: small PFC/food term list
- same microphone PCM is streamed in parallel to the conversational agent and the transcription model
- dedicated transcriber gets its own ephemeral token from the existing GAS V12 endpoint
- if it fails, the voice conversation continues and the UI falls back to the conversational agent's input transcription

The separation exists because real-device tests showed the Live agent can understand the meal correctly while its displayed `inputTranscription` can be badly wrong, including incorrect-language-looking text.

## Desired Live UX

- User presses Live once.
- Session stays open across multiple turns.
- Opening model utterance is short: `何を食べましたか？`
- Normal silence ends a speech turn, not the Live session.
- Gemini controls ordinary conversational wording and question order.
- Food cards appear/update during conversation.
- Natural corrections such as `それぞれ200g`, `ごめん鶏ももだった`, `米200じゃなくて150`, `納豆やっぱ消して` update the same draft items.
- Final registration is always an explicit user action.
- Session closes only through explicit end, page lifecycle, unrecoverable disconnect, or later-defined safety timeout behavior.

## Architecture invariant

```text
microphone PCM 16 kHz
  ├─ Gemini 3.1 Flash Live semantic conversation
  │    -> update_meal_draft Function Call
  │    -> semantic draft validator/store
  │    -> immediate card update
  │    -> background deterministic Food Resolver
  │    -> trusted Food ID
  │    -> Food Master
  │    -> nutrition engine
  │    -> explicit Register
  │
  └─ Gemini 3.5 Transcribe Live
       -> visible user transcript only
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

Do not hard-code detailed scripts or per-food question sequences.

App code controls only hard boundaries: session lifecycle, Function Calling schema, explicit chicken-breast exception, trusted resolver/nutrition truth, registration, transport, and safety/failure behavior.

Gemini controls ordinary acknowledgement, wording, question order, combining questions, references, and corrections.

Do not replace model intelligence with an expanding regex/rules engine.

## Critical product decision: no generic qualifier rules engine

Do not create a generalized `requiredQualifiers` system.

Add narrow explicit exceptions only when real product testing proves they are necessary.

### Current explicit exception: chicken breast only

For semantic chicken breast (`鶏胸`, `鶏胸肉`, `鶏むね`, etc.):

- never silently default to skinless in Live mode
- if skin state is unknown, keep it unknown
- candidate UI must not claim skinless
- Live should naturally ask skin-on vs skin-off when needed
- if amount is also missing, Live may combine those questions naturally
- once stated, update the same card/ref

Do not spread this rule to beef or unrelated foods without real evidence.

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

Re-resolve only when identity-affecting fields such as `name` or `variant` change. Amount-only changes reuse the existing trusted identity.

Every resolution request is revisioned so a late stale lookup cannot overwrite a newer correction.

## Formal Function Calling contract

Use exactly one custom function:

`update_meal_draft`

Do not split it into micro-tools such as `addFood`, `changeAmount`, or `deleteFood`.

### Input

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

- `add`: `name` required, persistent app ref is not invented by Gemini
- `update`: app-issued `ref` required; only changed semantic fields need to be sent
- `remove`: app-issued `ref` required
- nutrition/Food-ID/database fields are rejected

### Stable refs are app-owned

Example:

1. Gemini adds `鶏胸肉`.
2. App creates and returns `ref=item-1`.
3. User says `ごめん、鶏ももだった`.
4. Gemini updates `ref=item-1`.
5. The same card changes identity; no duplicate card is created.

When identity changes and Gemini does not provide a replacement variant, the store clears the old variant so chicken-specific state cannot leak into the new food.

### Tool response

The app returns semantic draft state and app-issued refs, but does not expose Food ID or nutrition/macros back to Gemini.

Resolver synchronization starts immediately after accepted semantic mutations, but the tool response does not wait for nutrition resolution.

## Authentication

- permanent Gemini API key remains only in GAS Script Properties
- browser never receives the permanent key
- GAS V12 issues one-use ephemeral tokens through `/v1beta/auth_tokens`
- conversational Live socket consumes one token
- dedicated Transcribe Live socket consumes a second token
- both tokens come from the same permanent Gemini API key/project

GAS V12 is currently stable and should not be edited merely because front-end Live behavior changes.

## Audio issue under diagnosis

Real-device v1.7.7 conversation quality is generally good, but the user hears repeated mechanical buzzer/tone artifacts.

The app does not intentionally generate a buzzer. v1.7.7 already introduced a small PCM jitter buffer. v1.7.8 adds event tracing so the buzzer can be correlated with:

- model-audio burst starts
- suspicious audio-arrival gaps
- Function Calls
- interruptions
- turn completion
- WebSocket errors/closes/goAway

Do not claim the buzzer is fixed until real-device testing proves it.

## Historical sandbox tests

The original network-free sandbox established these invariants before production wiring:

- session survives ordinary pause
- chicken breast does not default to skinless
- no generic meat-skin rules engine
- resolver starts before amount is known
- amount-only changes do not re-resolve identity
- stale async resolver result cannot overwrite a correction
- add/update/remove contract validation
- app-owned stable refs
- same card survives semantic correction
- Food ID/PFC/kcal fields are rejected from model input
- tool response does not leak nutrition truth
- Gemini `toolCall.functionCalls[]` adapts to `functionResponses[]`

Production CI and Android device tests supersede the sandbox for current runtime behavior.

## Legacy normal voice path remains separate

Do not rewrite `clean/src/voice/input.js` merely because Live changes.

The legacy normal-path issue where a transcript such as `鶏胸肉と米と納豆` could remain with an empty memo is a separate bug. Preserve the intended normal architecture:

`flexible semantic AI -> deterministic Food Resolver -> trusted Food ID -> Food Master`

## Immediate next test after v1.7.8

- verify dedicated Transcribe Live reaches ready state
- compare displayed Japanese transcript accuracy against v1.7.7
- verify conversational reasoning / audio / Function Calling remain unchanged
- reproduce the buzzer and inspect the visible audio-event trace immediately afterward
- only then decide whether the remaining tone is local playback, protocol interruption, or likely model-originated audio
