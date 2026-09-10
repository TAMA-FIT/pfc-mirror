# PFC Mirror Current Development State

Last memory refresh: 2026-09-11 JST

## Canonical rule

Fresh GitHub `main` is always canonical for code/version state. This file records intent, verified milestones, unresolved defects, and handoff context. If this file and Fresh `main` disagree about code or version, Fresh `main` wins.

## Runtime state before the current v1.7.8 candidate

- Production app version: **v1.7.7**
- Production `main` commit before the current branch: `b751ab913b134432351295c25ca42a3657f1f1df`
- Public URL: `https://tama-fit.github.io/pfc-mirror/`
- Root `index.html` is an active runtime entrypoint and must be updated together with `clean/index.html` when version/cache markers change.
- Current integration branch at this memory refresh: `feat/v178-transcribe-live-diagnostics`
- Intended next public version after merge: **v1.7.8**

## Gemini Live production status

Genuine Gemini Live is integrated as a separate path from the legacy normal voice-input path.

Android Chrome real-device testing has verified this sequence end-to-end:

1. Public GitHub Pages app opens Live UI.
2. App POSTs `taskType: liveToken` to the existing GAS deployment.
3. GAS V12 issues a short-lived Gemini token without exposing the permanent API key.
4. Browser opens the Gemini Live WebSocket.
5. `gemini-3.1-flash-live-preview` reaches `setupComplete`.
6. Model opens with `何を食べましたか？`.
7. User can speak naturally across multiple turns.
8. Gemini responds in natural audio.
9. `update_meal_draft` Function Calling updates food cards.
10. Existing deterministic Food Resolver / Food Master / nutrition engine remains authoritative.

Real-device draft examples have included chicken breast with clarified skin state and quantity, and natto with an assumed standard pack. The user reports the actual voice conversation is now generally good.

## Remaining real-device issues after v1.7.7

### 1. Mechanical buzzer/tone during model audio

The user still hears an obviously mechanical buzzer/tone several times during Live use, even after v1.7.7 added a small PCM playback jitter buffer.

Do not assume this is a network warning sound. There is no intentional app-side buzzer generator in the runtime. A current public Google issue also reports native Live audio degenerating into sustained non-speech tones, so server-originated malformed audio remains plausible.

The next candidate therefore adds event tracing around model audio, Function Calling, interruption, turn completion, WebSocket close/error, and suspicious audio-arrival gaps. This is diagnostic instrumentation, not proof that the buzzer is fixed.

### 2. Live agent input transcription is inaccurate

The Live conversational model often understands the user semantically even when its `inputTranscription` display is poor. A real-device screenshot showed clearly wrong displayed text including Korean-looking characters while Gemini still understood the meal and updated the draft correctly.

Therefore semantic conversation and user-visible transcription are now treated as separate responsibilities.

## v1.7.8 candidate: dedicated display transcription

The candidate keeps the conversational agent unchanged and adds a second parallel Live transcription session only for the visible `あなた` transcript.

Architecture:

```text
same microphone PCM 16 kHz
  ├─ Gemini 3.1 Flash Live
  │    -> conversation / reasoning / audio reply / Function Calling
  │
  └─ Gemini 3.5 Transcribe Live
       -> visible Japanese user transcript only
```

Officially verified transcription endpoint/model:

- model: `gemini-3.5-transcribe-live`
- response modality: `TEXT`
- language hint: `ja-JP`
- mode: `SMART`
- custom vocabulary: a small PFC/food-oriented list such as `鶏胸肉`, `納豆`, `白米`, `MCTオイル`, etc.
- raw input: 16-bit PCM at 16 kHz mono
- Live Transcribe continuous session limit currently documented as 10 minutes

Implementation behavior:

- obtain a **second** ephemeral token from the same existing GAS V12 endpoint; GAS itself is unchanged
- connect a separate `BidiGenerateContentConstrained` WebSocket for `gemini-3.5-transcribe-live`
- send the same captured PCM bytes to both sockets
- use finalized `inputTranscription` from the dedicated transcriber for the displayed user text
- ignore the conversational agent's poorer input transcription while the dedicated transcriber is healthy
- if the dedicated transcriber fails or closes, keep the voice conversation alive and fall back to the existing agent transcription rather than killing the session
- no separate permanent API key is introduced

## v1.7.8 audio diagnostic trace

The candidate adds a small visible event trace in the Live sheet. It records only timing/event metadata, not raw audio and not microphone recordings.

Tracked signals include:

- model audio burst start
- suspicious 140–700 ms audio-arrival gaps
- Function Call / Function Call cancellation
- `interrupted`
- `turnComplete`
- WebSocket error/close/goAway
- cumulative model-audio chunk count

The purpose is to correlate the user's heard buzzer with Live protocol events. If the buzzer occurs while the trace shows no gap/interruption/tool event, malformed audio coming from Gemini becomes a stronger hypothesis.

## GAS / authentication state

The user manually deployed **GAS V12**. Keep it unchanged for v1.7.8.

The same Script Properties Gemini API key remains the only permanent key. The browser only receives short-lived tokens. The v1.7.8 transcriber requests its own second one-use token because one token is already consumed by the conversational Live socket.

## Live semantic architecture invariant

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

Gemini may interpret food names, quantities, units, references, corrections, deletions, and semantic variants. Gemini must not author P/F/C/A, kcal, Food IDs, nutrition values, or database truth.

## Chicken breast exception

Do not build a generic per-food qualifier rules engine.

The currently explicit product exception is chicken breast only:

- Live must not silently assume skinless when skin state is unknown.
- Ask naturally for skin-on/skin-off when needed.
- If quantity is also unknown, Gemini may combine questions naturally.
- Once clarified, update the same draft item/card.

Do not spread this exception to unrelated foods without real product evidence.

## Legacy normal voice path

The existing normal `話して記録` path remains separate and is intentionally untouched by Live development. A previously observed normal-path dead-end (`鶏胸肉と米と納豆` transcript visible but memo empty) is still not considered device-verified fixed.

Do not solve the normal path by expanding regex rules. Its intended architecture remains:

`flexible semantic AI -> deterministic Food Resolver -> trusted Food ID -> Food Master -> mechanical nutrition`

## Development protocol reminders

- Do not jump from a new symptom straight into production edits.
- Discuss symptom, target UX, likely cause, scope, and side effects first.
- Fresh-check `main` before branching and again before merge.
- Keep Live changes isolated from stable normal AI/voice/storage/nutrition code unless explicitly required.
- Branch -> CI -> PR/diff -> merge -> real-device verification.
- CI success is not device success.
- Every public runtime change gets a visible version bump.

## Immediate device test after v1.7.8 merge

1. Confirm visible `v1.7.8`.
2. Start Live and confirm normal `setupComplete`.
3. Confirm the `文字起こし` diagnostic shows `gemini-3.5-transcribe-live | ja-JP | SMART`.
4. Speak food terms that previously mistranscribed and verify the visible `あなた` text is substantially better.
5. Verify Gemini conversation and Function Calling/card updates remain unchanged.
6. Listen for the buzzer and immediately note/screenshot the `音声イベント` line.
7. If the buzzer persists, compare whether it correlates with `audio-gap`, `interrupted`, `toolCall`, or `turnComplete` before changing audio code again.
