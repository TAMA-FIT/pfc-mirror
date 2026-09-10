# Gemini Live Integration — v1.7.2

Date: 2026-09-10 JST

This file records the current production-integration debugging state for Gemini Live. Fresh GitHub `main` remains canonical for code and version state.

## Current public app target

- App runtime version: `v1.7.2`
- Live model: `gemini-3.1-flash-live-preview`
- Existing normal voice input / normal AI / Food Master / storage are intentionally not modified by this change.
- Genuine Live remains a separate experimental entrypoint.

## GAS state expected by this runtime

The user manually updated the existing Apps Script deployment to **GAS Live Token V11**.

V11 behavior:

- `taskType: "liveToken"`
- permanent Gemini API key remains in Apps Script Script Properties
- GAS calls `POST https://generativelanguage.googleapis.com/v1beta/auth_tokens`
- request payload is intentionally minimal: `{ "uses": 1 }`
- success response includes `gasBuild: "PFC_GAS_LIVE_TOKEN_V11"`, `phase: "auth_tokens_ok"`, and the ephemeral token
- failure response includes the same build marker plus phase / HTTP / Google status / sanitized message

The prior `PFC_GAS_PROBE_V10` diagnostic proved that the public app reaches the intended current GAS deployment and `doPost()` route. Therefore cache/wrong-deployment routing is no longer the primary suspicion.

## v1.7.2 app-side diagnostics

The Live token transport now keeps the ephemeral token private while exposing only safe diagnostic metadata to the UI:

- app version
- GAS build marker
- GAS phase
- HTTP status when supplied
- Google status when supplied
- sanitized GAS diagnostic message
- WebSocket open / setupComplete / close stages

The Live modal renders these under a visible `診断` block. This is specifically for real-device debugging.

## Expected first real-device sequence

1. App header shows `v1.7.2`.
2. User taps `ライブ会話`.
3. Diagnostic should show `PFC_GAS_LIVE_TOKEN_V11` if V11 is really deployed.
4. If token creation succeeds, phase should include `auth_tokens_ok` and the runtime proceeds to WebSocket.
5. Next visible diagnostic should progress through `WebSocket open` and `setupComplete`.
6. Only after setup completes should microphone streaming / opening utterance / Function Calling become the focus.

## If the next test fails

Do not broadly rewrite Live.

Use the exact last diagnostic stage:

- no V11 marker -> deployment/version mismatch
- V11 + auth_tokens error -> token endpoint/API-key/account issue
- V11 auth_tokens_ok but WebSocket error -> constrained WebSocket/auth/setup issue
- setupComplete but no audio -> browser audio capture/playback path
- audio works but no meal cards -> Function Calling / semantic draft path

Each runtime/GAS behavior change must receive a new visible app version so the user can distinguish cache state during device testing.
