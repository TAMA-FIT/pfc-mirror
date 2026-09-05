# Voice Lab A/B/C experiment

This branch isolates three Gemini voice architectures behind the existing three voice-mode storage values without changing the Clean Runtime data model or Food Master authority.

- `voice` → **A 最速Live**: Conversation Live handles ears + brain + mouth.
- `chat` → **B 専用耳Live**: Gemini 3.5 Transcribe Live is the ear; Conversation Live handles brain + mouth.
- `auto` → **C 完全分離**: Gemini 3.5 Transcribe Live is the ear; Gemini 3.5 Flash Lite is the brain; Conversation Live is the mouth.

The benchmark stores up to 120 local samples in `tf_voice_bench_v1` and tracks speech-end to finalized transcript, brain time, mouth-to-first-audio, total response, and connection setup. A manual transcription accuracy rating is available in the voice sheet.

Nutrition remains deterministic: Live/Flash models return only food identity, amount, unit, meal, and clarification intent; Food Master supplies nutrition values.

## Security prerequisite

Public GitHub Pages must not contain the long-lived Google AI Studio API key. The browser requests a one-use short-lived Gemini Live token from the existing PFC GAS backend (`taskType: liveToken`) and then connects to the constrained Live WebSocket endpoint with that ephemeral token.

Do not promote this branch to production until the PFC GAS backend has the token issuer deployed and verified.
