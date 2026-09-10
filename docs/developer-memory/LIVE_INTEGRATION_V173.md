# Gemini Live Integration v1.7.3

Date: 2026-09-10 JST

## Purpose

v1.7.3 is the public-app companion build for GAS Live Token V12 real-device diagnosis.

## GAS side expected by this build

- GAS build marker: `PFC_GAS_LIVE_TOKEN_V12`
- `taskType === "liveToken"` is handled inline inside `doPost()`.
- The Live token path does not call `handleLiveTokenRequest()`.
- GAS calls `POST https://generativelanguage.googleapis.com/v1beta/auth_tokens` with the existing Script Properties `GEMMA_API_KEY`.
- Initial token payload is intentionally minimal: `{ uses: 1 }`.
- The permanent API key is never returned to the browser.

## Public app changes

- Visible/runtime version: `v1.7.3`.
- Root and clean entrypoints are cache-busted to v1.7.3.
- Live runtime/config/CSS cache references are refreshed to v1.7.3 where needed.
- Existing v1.7.2 diagnostic UI remains in place and can display `gasBuild`, `phase`, HTTP status, Google status, WebSocket open, and setupComplete.

## Protected paths

This build does not intentionally modify the normal voice-input implementation, normal text AI, Food Master, nutrition engine, or storage behavior.

## Device-test interpretation

Expected first checkpoint after deployment:

- Header shows `v1.7.3`.
- Live diagnostic shows `PFC_GAS_LIVE_TOKEN_V12` if the updated GAS is active.
- If token creation succeeds, diagnostics should advance from token to `WebSocket open`, then `setupComplete`.
- If token creation fails, the diagnostic should include the V12 build marker and Google HTTP/status details.

## Important

Fresh GitHub `main` is canonical for code/version state. This document records intent and the expected GAS/app pairing only.
