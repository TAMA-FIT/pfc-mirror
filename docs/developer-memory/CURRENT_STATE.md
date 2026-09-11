# PFC Mirror Current Development State

Last memory refresh: 2026-09-11 JST

## Canonical rule

Fresh GitHub `main` is always canonical for code and version state. This file records current architecture, verified milestones, known limits, and release gates. If this file conflicts with Fresh `main`, Fresh `main` wins.

## Public runtime

- Public URL: `https://tama-fit.github.io/pfc-mirror/`
- v1.7.18 production main before the current candidate: `ebdc8a9a47c7f270731bccbfbc24fe55b0c8d232`
- Current candidate: **v1.7.19**
- Candidate PR: **#46 — Consolidate Gemini Live flow and lifecycle in v1.7.19**
- Root `index.html` and `clean/index.html` are both active version/cache surfaces and must move together.

## Current Gemini Live architecture

The production path is Free Tier oriented and must not depend on paid Google Search Grounding.

```text
microphone
  -> Gemini 3.1 Flash Live conversation
  -> update_meal_draft Function Calling
  -> LiveMealDraft
  -> trusted Food Master / MEXT resolver
  -> card preview
  -> explicit user Register
  -> deterministic record write
```

A second `gemini-3.5-transcribe-live` stream remains dedicated to visible Japanese transcription. Permanent Gemini API keys stay in GAS; the browser receives short-lived tokens.

### v1.7.19 production wiring

`clean/src/main-v160.js` loads the consolidated `live-v1719.js` runtime. The old v1.7.16 Live runtime and `free-tier-search-hotfix-v1717.js` remain historical files only and must not be loaded by the production entrypoint.

`config-v1719.js` contains the Free Tier contract directly. There is no runtime WebSocket monkey patch and no `googleSearch` tool in the setup payload.

## Nutrition resolution priority

The intended precedence is:

1. **User-declared package/menu nutrition (`user-label`)** — if the user explicitly reads P/F/C from a product label/menu, keep those exact values. If kcal is absent, derive kcal mechanically with `4P + 9F + 4C` and mark it as derived.
2. **Trusted local DB** — Food Master / MEXT exact trusted resolution. AI must not overwrite an already resolved DB item with an estimate.
3. **AI estimate (`ai-estimate`)** — only when the food remains unresolved and the user did not provide explicit nutrition. It is stored/displayed as an estimate, never as official data.

Paid `official-web` / Google Search is currently disabled in the public Free Tier path.

## Standard amount transparency

Do not invent gram conversions that the source DB does not contain.

Examples:

- Food Master basis `並` -> display a source-faithful label such as `並（1食）`.
- A verified conversion such as rice `1杯 = 150g` may show both.
- If the DB only knows `1個`, `1皿`, `並`, etc., do not fabricate grams.

## v1.7.19 turn guard

Real-device v1.7.18 exposed an important failure mode: Gemini could correctly recognize a food verbally but skip `update_meal_draft`. That left the memo empty and Register permanently disabled.

v1.7.19 adds an app-side recovery layer so correctness does not depend entirely on model tool-call compliance:

- after a user turn, if the Draft is still empty/pending, the app checks the transcript
- for a simple food utterance the app can create a provisional Draft item itself
- trusted Food Master resolution may immediately make it registerable
- truly unresolved items trigger an internal recovery instruction asking Gemini to use a clear Food Master candidate or attach `ai-estimate` evidence
- recovery attempts are bounded; normal quantity/skin clarification states are not treated as unresolved-food failures
- the model must not tell the user to press Register while `ready=false`

The current Food Master includes `ポテト(L)` with P6 / F25 / C65 / 517 kcal, so the real-device phrase `ポテト（L）` should be recoverable through trusted DB even if Gemini initially only replies verbally.

## Live card contract

Before Register is enabled, the Live card is the user-visible source of truth for what will be saved.

For a ready item the card must show:

- resolved/display food name
- amount / serving basis
- source/status (`標準量`, `パッケージ・表示値`, `AI推定・目安`, etc.)
- kcal and P/F/C preview

The Register button is enabled only when `draft.isReady()` is true. Registration then uses the same trusted DB/evidence object shown by the card.

## Browser / microphone lifecycle

Live microphone capture must never silently remain active after the user leaves the Live surface.

v1.7.19 behavior:

- opening Live pushes a same-page history state
- Android/browser Back while Live is open is treated as closing Live first
- cleanup closes the transcriber and Live WebSocket and calls `stopCapture()` on the microphone tracks before returning/reloading the home surface
- `pagehide` and `beforeunload` are emergency release paths
- **do not auto-close on `visibilitychange` yet**; the user has not decided whether temporarily switching apps should end Live

## Audio playback status

The previous mechanical-buzzer investigation remains resolved at the architecture level by the persistent AudioWorklet playback path. Keep the existing AudioWorklet/diagnostic code unless a new real-device regression proves otherwise.

## Release-gate lesson from v1.7.16-v1.7.18

Do not validate a feature only at schema/function level and then ship it.

For every user-visible Live behavior change, test the complete user journey that the change claims to support. For food recording this means, as applicable:

```text
user speech
 -> transcription/semantic interpretation
 -> Tool Call OR app-side recovery
 -> card appears
 -> correct source/amount/PFC is visible
 -> draft reaches ready=true
 -> Register becomes enabled
 -> saved record matches preview
 -> leaving Live releases microphone/resources
```

A passing prompt/schema test is not sufficient if the visible card, registration gate, or resource lifecycle has not also been checked.

## CI gates for v1.7.19

PR #46 adds/updates contracts covering:

- current Live runtime syntax
- no Google Search in Free Tier setup
- `ポテト（L）` transcript normalization and real Food Master row presence
- model-skips-tool -> app provisional card -> trusted Food Master -> `ready=true`
- true unknown -> internal recovery -> `ai-estimate` -> `ready=true`
- user package P/F/C -> `user-label` -> derived kcal when needed -> `ready=true`
- kcal/P/F/C preview in Live cards
- Register gate tied to Draft readiness
- browser Back -> Live cleanup -> microphone track stop
- no automatic `visibilitychange` shutdown
- production entrypoint uses only v1.7.19 Live runtime

CI success is still not a substitute for Android real-device verification.

## Immediate Android verification after v1.7.19 deploy

Test the flow, not isolated controls:

1. Confirm visible `v1.7.19`.
2. Start Live and say `ポテト（L）`.
3. Even if Gemini initially only answers verbally, confirm a `ポテト(L)` card appears.
4. Confirm the card shows amount plus kcal/P/F/C and becomes `登録できます`.
5. Confirm `これで登録する` is enabled and saves the displayed values.
6. Start another Live session and say a genuinely unregistered product such as `サムライマック`.
7. Confirm it does not remain permanently unresolved; it should become `AI推定・目安` with kcal/P/F/C and become registerable.
8. Test a package readout such as `このカツ丼、P18.5、F24、C82` and confirm those values are preserved as `パッケージ・表示値`.
9. Start Live again and press Android/browser Back instead of `ライブを終了`.
10. Confirm the app returns to its home surface and the microphone indicator turns off so another app can immediately acquire the mic.
