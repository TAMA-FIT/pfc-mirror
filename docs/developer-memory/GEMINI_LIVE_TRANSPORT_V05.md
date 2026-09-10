# Gemini Live Transport Memory — Sandbox v0.5

Last refresh: 2026-09-10 JST

This file records the first credential-safe real Gemini Live transport design. It is documentation only and must never be imported by production runtime.

## Current sandbox artifact

`pfc-mirror-gemini-live-sandbox-v0.5.zip`

The ZIP is a chat-local workbench. It is not deployed production code.

## Fresh official API facts verified before v0.5

Current official Google model ID selected for the first real smoke test:

`gemini-3.1-flash-live-preview`

Raw WebSocket API target:

`v1beta GenerativeService.BidiGenerateContent`

For browser/client-side production use, do not embed the permanent Gemini API key in GitHub Pages. Use a backend-issued short-lived Gemini Live ephemeral token and connect the browser directly to Gemini using the constrained Live WebSocket endpoint.

Browser-side constrained endpoint shape:

`...BidiGenerateContentConstrained?access_token=<ephemeral-token>`

Input audio contract is raw little-endian PCM16. 16 kHz is the preferred input capture rate. Model audio output is streamed separately and playback is intentionally outside the transport module.

## Security architecture

```text
permanent Gemini API key
  -> backend secret store only
  -> backend mints short-lived Live ephemeral token
  -> browser receives ephemeral token
  -> browser connects directly to Gemini Live WebSocket
  -> permanent API key never enters static GitHub Pages bundle
```

The backend token endpoint contract in sandbox is intentionally small:

`POST /live-token`

Response:

```json
{
  "token": "<short-lived-token>",
  "expiresAt": "<optional ISO timestamp>"
}
```

The actual permanent API key is never stored in the sandbox ZIP.

## v0.5 executable modules

New transport-side modules:

- `live/gemini-live-config.js`
- `live/live-token-provider.js`
- `live/gemini-live-transport.js`
- `live/live-runtime.js`
- `live/live-session-factory.js`
- `backend-contract/EPHEMERAL_TOKEN_ENDPOINT.md`
- `docs/REAL_LIVE_SMOKE_PLAN.md`

Existing semantic/function modules remain separate:

- `live/update-meal-draft-tool.js`
- `live/update-meal-draft-contract.js`
- `live/update-meal-draft-handler.js`
- `live/gemini-tool-call-adapter.js`
- `live/meal-draft-store.js`
- `live/resolver-coordinator.js`
- `live/draft-resolution-bridge.js`
- `live/chicken-breast-exception.js`

## Transport behavior

The transport now models the real Live protocol boundary:

1. obtain ephemeral token from token provider
2. open constrained v1beta WebSocket
3. send Live setup with AUDIO response modality
4. include one custom Function Calling declaration: `update_meal_draft`
5. wait for `setupComplete`
6. send an internal start signal that asks for the short opening line `何を食べましたか？`
7. accept realtime text/audio input
8. parse model audio/transcription/toolCall events
9. run local `update_meal_draft`
10. send `toolResponse.functionResponses[]` back over the same socket

The transport does not own microphone capture, audio playback, Food ID resolution, nutrition calculation or persistence.

## VAD decision status

Automatic VAD remains configurable and is not product-locked yet.

Sandbox tests exercise `silenceDurationMs: 800` only as a protocol/configuration test value. Real Android testing must decide the actual value. Ordinary pause ends a user turn, not the Live session.

## Opening behavior

After `setupComplete`, the client sends an internal start signal asking Gemini to begin with one short utterance:

`何を食べましたか？`

The start signal explicitly says not to mutate the meal draft by itself.

## Function Calling boundary remains unchanged

Use exactly one custom function:

`update_meal_draft`

Gemini may send semantic add/update/remove operations only.

Gemini must not author Food IDs, P/F/C/A, kcal, nutrition or database/source truth.

Stable card refs are app-owned. Add operations do not supply refs. Update/remove operations reuse app-issued refs from prior tool responses.

## Sandbox v0.5 tests

Network-free suite passes with exit code 0. Total: 16 tests.

New v0.5 tests include:

- ephemeral token provider contract
- constrained WebSocket URL and absence of permanent `?key=` auth
- current official model ID in setup
- AUDIO response modality
- `update_meal_draft` tool declaration included in setup
- configurable automatic VAD
- `setupComplete` readiness
- opening signal after setup
- realtime text send
- PCM16 realtime audio send
- `audioStreamEnd`
- Live tool-response format
- input/output transcription event parsing
- output audio event parsing
- fake-WebSocket full Function Calling roundtrip
- authentication boundary safety test

All earlier semantic/draft/resolver/stale-result tests continue to pass.

## What has NOT been proven yet

Do not overclaim any of the following:

- no real Gemini credential was used in sandbox v0.5
- no real Gemini WebSocket handshake has been executed yet
- no real model audio has been received yet
- no real Function Call has been observed from Gemini yet
- no microphone capture or 16 kHz conversion has been implemented/tested on Android yet
- no audio playback module has been implemented/tested yet
- no production UI has been connected
- no production runtime JS/CSS has been modified by this sandbox work

## Next real-development gate

Before production integration, perform a minimal real Live smoke test using a valid short-lived token:

1. connect
2. receive `setupComplete`
3. get opening audio `何を食べましたか？`
4. say/send `鶏胸と米と納豆食べた`
5. verify a structurally valid `update_meal_draft` Function Call
6. return app-issued refs in tool response
7. verify model continues conversation naturally
8. test `肉と米は200gずつ。鶏胸は皮あり`
9. test `ごめん、鶏胸じゃなくて鶏ももだった。米も150だった`
10. test `納豆やっぱ消して`

Only after that should microphone capture/audio playback and existing UI integration begin.

## Resume rule

Future chats must read the core developer-memory files and this file, then fetch Fresh GitHub. Fresh GitHub is canonical for code/version state. This file is canonical for the v0.5 transport intent and constraints unless the user explicitly changes them.
