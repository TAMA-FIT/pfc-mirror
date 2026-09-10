# PFC Mirror Current Development State

Last memory refresh: 2026-09-11 JST

## Canonical rule

Fresh GitHub `main` is always canonical for code/version state. This file records development intent, verified milestones, unresolved defects, and handoff context. If this file and Fresh `main` disagree about code or version, Fresh `main` wins.

## Runtime state before the current v1.7.7 candidate

- Production app version: **v1.7.6**
- Production `main` commit before the current branch: `90fc605a268412b26bd8a98c41d8a6201507f253`
- Public URL: `https://tama-fit.github.io/pfc-mirror/`
- Root `index.html` is an active runtime entrypoint and must be updated together with `clean/index.html` when version/cache markers change.
- Current integration branch at this memory refresh: `fix/v177-live-audio-transcript`
- Intended next public version after merge: **v1.7.7**

## Gemini Live production integration status

Genuine Gemini Live is now integrated into the production app as a separate Live path from the legacy normal voice-input path.

User device verification on Android Chrome has already proven the following sequence works:

1. GitHub Pages opens the Live UI.
2. App POSTs `taskType: liveToken` to the existing GAS endpoint.
3. GAS V12 obtains a short-lived Gemini Live token without returning the permanent API key.
4. Browser opens the Gemini Live WebSocket.
5. Gemini Live returns `setupComplete`.
6. The model opens with `何を食べましたか？`.
7. User speech is transcribed.
8. Gemini Live responds conversationally.
9. `update_meal_draft` Function Calling updates food cards.
10. Existing deterministic resolver/Food Master/nutrition path remains authoritative for food identity/nutrition.

The user has device-verified a draft containing at least:

- chicken breast resolved as skinless at 200 g after the user clarified it
- natto represented as one assumed pack

This proves basic real Live conversation + Function Calling + draft-card mutation is working end-to-end. It does **not** yet prove all correction/reference/reconnect/audio-quality cases.

## GAS / authentication state

The user deployed **GAS V12** manually in Apps Script. Keep GAS V12 unchanged unless a later issue specifically points back to token issuance.

The same Script Properties Gemini API key is used for normal Gemini requests and for issuing Gemini Live ephemeral tokens. The permanent key must never be committed to GitHub or returned to the browser.

Earlier diagnostics established:

- PROBE V10 proved the public app was calling the intended GAS deployment.
- V11/V12 token work progressed through Apps Script and eventually succeeded.
- Android Chrome initially returned `Failed to fetch`; later V12 + app changes succeeded.
- Android Chrome then returned WebSocket message frames as `Blob`; v1.7.6 added string/Blob/ArrayBuffer decoding and device verification reached `setupComplete`.

## v1.7.7 candidate: audio and transcript polish

Real-device Live testing exposed two UX defects after basic Live success:

1. Intermittent `ビー` / buzzer-like audio artifacts during model playback.
2. Output transcription text accumulated/repeated across turns and fragments.

The v1.7.7 candidate changes only the Live front-end path:

- adds a small Web Audio jitter buffer with ~120 ms preroll and rebuffer threshold
- keeps sequential PCM chunks scheduled ahead instead of starting a late chunk almost immediately
- adds transcript fragment coalescing for cumulative/repeated/overlapping fragments
- resets the displayed transcript pair when speaker turns change, so old turns do not keep concatenating into the current AI card
- cache-busts Live modules to v1.7.7

Normal AI, legacy voice input, Food Master, nutrition engine, storage, and GAS V12 are intentionally untouched.

The audio and transcript changes are automated-test candidates only until the user verifies them on the Android device. Do not claim the buzzer or transcript defect fixed before that device test.

## Live architecture invariant

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

Gemini may interpret food names, quantity/unit, references, corrections, deletion and semantic variants. Gemini must not author P/F/C/A, kcal, Food IDs, nutrition values, or database truth.

## Chicken breast exception

Do not build a generic per-food qualifier rules engine.

The currently explicit product exception is chicken breast only:

- Live must not silently assume skinless when skin state is unknown.
- Ask naturally for skin-on/skin-off when needed.
- If quantity is also unknown, Gemini may combine questions naturally.
- Once clarified, update the same draft item/card.

Do not spread this exception to beef or unrelated foods unless real testing establishes a product need.

## Open normal-voice defect

The legacy normal voice-input path remains separate from Gemini Live. A previously reported case such as `鶏胸肉と米と納豆` could leave a transcript visible while the meal memo remained empty.

Source comparison showed v1.6 did not simply replace the normal voice/AI core. Do not solve this by piling on regex rules. The intended normal-AI architecture remains:

`flexible semantic AI -> deterministic Food Resolver -> trusted Food ID -> Food Master -> mechanical nutrition`

This legacy-path issue is still not considered device-verified fixed.

## Development protocol reminders

- Do not jump directly into implementation from a newly reported symptom.
- Discuss symptom, likely cause, target UX, side effects, and scope first.
- Fresh-check `main` before branching and again before merge because `main` has moved unexpectedly during prior work.
- Prefer isolated Live changes; protect stable normal AI/voice/storage/nutrition code.
- Branch -> CI -> PR/diff -> merge -> real-device verification.
- A CI pass is not a device pass.
- Every public runtime change gets a visible version bump so the user can distinguish cache/runtime states.

## Immediate next action after v1.7.7 merge

Real-device test on Android Chrome:

1. confirm visible version v1.7.7
2. start Live and confirm `setupComplete`
3. listen for buzzer/click artifacts through several model replies
4. make at least two user/model turns and verify old transcript text does not concatenate into the next turn
5. verify cards still update through Function Calling
6. test a correction such as `米200じゃなくて150` or `ごめん鶏ももだった`

If audio artifacts remain, diagnose playback timing/feedback separately rather than modifying semantic/Function Calling logic.
