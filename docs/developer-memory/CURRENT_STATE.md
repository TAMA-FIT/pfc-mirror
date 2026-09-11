# PFC Mirror Current Development State

Last memory refresh: 2026-09-11 JST

## Canonical rule

Fresh GitHub `main` is always canonical for code/version state. This file records intent, verified milestones, unresolved defects, and handoff context. If this file and Fresh `main` disagree about code or version, Fresh `main` wins.

## Current runtime / candidate

- Production app before this candidate: **v1.7.10**
- Production `main` before the v1.7.11 branch: `e6b3dc7cedb12e7a397ad015274b9b62bc2777cc`
- Current candidate branch: `fix/v1711-audio-worklet-stream`
- Intended next public version: **v1.7.11**
- Public URL: `https://tama-fit.github.io/pfc-mirror/`
- Root `index.html` is an active runtime entrypoint and must be updated together with `clean/index.html` when version/cache markers change.

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

The user reports the actual voice conversation quality is now generally good.

## Dedicated display transcription — device verified

v1.7.8 split visible user transcription away from the conversational Live model:

```text
same microphone PCM 16 kHz
  ├─ Gemini 3.1 Flash Live
  │    -> conversation / reasoning / audio reply / Function Calling
  │
  └─ Gemini 3.5 Transcribe Live
       -> visible Japanese user transcript only
```

Current transcription configuration:

- model: `gemini-3.5-transcribe-live`
- response modality: `TEXT`
- language: `ja-JP`
- mode: `SMART`
- small PFC/food custom vocabulary

Real-device v1.7.8 testing showed a clear improvement. A phrase equivalent to `鶏むねと米と納豆。` displayed correctly while the Live conversational agent also interpreted it correctly.

The transcriber uses a second ephemeral token from the same GAS V12 endpoint. No additional permanent API key is exposed.

## Remaining real-device issue: mechanical buzzer / tone

The user still hears an obviously mechanical buzzer/tone repeatedly during model audio.

Important observations from v1.7.8 device tracing:

- the app has no intentional buzzer generator
- the buzzer occurred without an `interrupted` event
- the same model turn showed model-audio arrival gaps around **213 ms** and **154 ms**
- tool calling and `turnComplete` still occurred normally

This makes streaming playback underrun / rebuffer behavior a strong candidate, but malformed/tone-like PCM already present in Gemini output remains possible.

Do not call the cause confirmed until the v1.7.9 raw-PCM replay test is done on device.

## v1.7.9 candidate: true ~300 ms jitter buffer

The old v1.7.7/v1.7.8 playback path scheduled incoming PCM almost immediately with only ~120 ms recovery lead. That was not a real queue and could still run dry when a 150–200+ ms arrival gap occurred.

v1.7.9 changes only the Live model-audio playback path:

- target buffer: ~300 ms
- rebuffer threshold: ~60 ms of scheduled audio remaining
- initial/recovery playback waits until ~300 ms of PCM has accumulated
- once buffered, chunks are scheduled contiguously ahead of playback
- if the scheduled queue runs close to empty, new PCM is accumulated again before resuming
- short final responses below 300 ms are force-flushed at `turnComplete`

This intentionally trades roughly a few tenths of a second of response latency for stability.

## v1.7.9 raw PCM diagnostic replay

The app now retains the exact Gemini model PCM chunks for the last completed model turn in memory only.

A diagnostic button appears:

`PCM診断：直前AI音声を一括再生`

Behavior:

- same-rate PCM chunks are concatenated into one continuous local `AudioBuffer`
- network arrival timing and normal chunk-by-chunk streaming scheduling are removed from the replay
- microphone forwarding to both Live sockets is paused while the diagnostic replay is playing so Gemini does not hear its own replay
- no raw PCM is uploaded or persisted by this diagnostic feature

Interpretation:

```text
normal Live playback buzzes
+
one-piece raw PCM replay is clean
-> browser streaming / jitter scheduling remains the likely source

one-piece raw PCM replay also contains the buzzer
-> the artifact is already present in Gemini-provided PCM or in local PCM decoding itself
```

This device test is the next decisive step.

## GAS / authentication state

The user manually deployed **GAS V12**. Keep it unchanged for v1.7.9.

The same Script Properties Gemini API key remains the only permanent key. The browser only receives short-lived tokens.

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

## Immediate device test after v1.7.9 merge

1. Confirm visible `v1.7.9`.
2. Start Live and confirm `setupComplete` plus dedicated `gemini-3.5-transcribe-live | ja-JP | SMART` transcription.
3. Speak through at least one full AI reply and listen for the buzzer.
4. Confirm the Live diagnostic shows `再生バッファ 300ms`.
5. After the reply completes, press `PCM診断：直前AI音声を一括再生`.
6. Compare whether the buzzer is present in the one-piece replay.
7. Report both results separately: `通常再生で鳴った/鳴らない` and `PCM診断再生で鳴った/鳴らない`.

## v1.7.9 real-device result

Observed on Android Chrome on 2026-09-11:

- Normal real-time Live playback: **buzzer reproduced**.
- `PCM診断：直前AI音声を一括再生`: **no buzzer**.
- Example captured turn: about 5.7 seconds / 28 PCM chunks.
- This makes corruption in the model-produced PCM itself unlikely. The next isolation target is the browser chunked playback scheduler versus live network-arrival timing.

## v1.7.10 next device test

v1.7.10 adds a second diagnostic replay using the exact saved PCM chunk sequence and the same 300 ms buffered scheduling path as normal Live playback, but without WebSocket/network arrival gaps.

1. Confirm visible `v1.7.10`.
2. Produce one AI reply that reproduces or can be compared with the buzzer.
3. Press `PCM診断①：直前AI音声を一括再生` and confirm the known clean baseline.
4. Press `PCM診断②：同じchunksを再生経路で再生`.
5. If ② buzzes while ① is clean, the Web Audio chunk scheduling/boundary path is implicated.
6. If both ① and ② are clean while normal Live playback buzzes, real network arrival timing / underrun-rebuffer behavior is implicated.

## v1.7.10 real-device result

Android Chrome verification on 2026-09-11 produced the decisive result:

- Normal real-time Live playback: **buzzer reproduced**.
- Diagnostic ① one-piece raw PCM replay: **clean**.
- Diagnostic ② exact same saved PCM chunks replayed locally through the old 300 ms BufferSource scheduler: **buzzer reproduced**.

Because diagnostic ② has no WebSocket/network arrival timing, network jitter is not required to reproduce the artifact. The common factor between normal Live and diagnostic ② is the chunk-by-chunk `AudioBufferSourceNode` scheduling path. The one-piece PCM buffer remaining clean strongly implicates node/chunk boundary scheduling rather than the model PCM content itself.

## v1.7.11 continuous AudioWorklet playback candidate

v1.7.11 replaces normal Gemini model-audio output on supported browsers with one persistent `AudioWorkletNode`:

- incoming 24 kHz PCM chunks are queued into one persistent processor instead of creating one `AudioBufferSourceNode` per chunk
- the processor keeps the existing ~300 ms startup/rebuffer target
- linear resampling is continuous across chunk boundaries inside the processor
- a short fade-in is applied on start/rebuffer
- `turnComplete` flushes any final audio below the 300 ms target
- interruption resets the persistent queue immediately
- unsupported browsers retain the old BufferSource path only as an explicit fallback
- diagnostic ① remains the one-piece PCM baseline
- diagnostic ② now feeds the same saved chunks through the new AudioWorklet engine

Immediate device verification for v1.7.11:

1. Confirm visible `v1.7.11`.
2. Confirm `再生エンジン` shows `AudioWorklet 連続ストリーム`.
3. Listen to a normal Live reply.
4. Run diagnostic ① and ②.
5. Expected fix result: normal Live, ① and ② are all clean.
6. If a buzzer remains, capture whether `worklet-underflow` appears in the event trace before changing anything else.
