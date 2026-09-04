# Gemini Voice architecture (Clean 1.2)

## Goal
Replace browser `SpeechRecognition` as the primary ear of the PFC app while keeping the Clean Runtime, Food Master authority, localStorage compatibility, and current Voice First / Touch Assisted UI.

## Active path

1. Browser microphone is captured with `getUserMedia` + `MediaRecorder`.
2. Web Audio is used only for local voice activity / silence detection. It does not transcribe speech.
3. After about 3.2 seconds of silence, or when the user taps the microphone again, the recorded audio blob is finalized.
4. The blob is sent through the existing server-side GAS bridge to Gemini.
5. Primary transcription model: `gemini-3.6-flash`.
6. Fallback transcription model: `gemini-3.5-flash-lite`.
7. The returned transcript is passed into the existing meal memo parser.
8. Food Master remains the nutrition source of truth when records are committed.

## Removed from the active microphone path

- `SpeechRecognition`
- `webkitSpeechRecognition`
- browser ASR restart loops
- browser ASR interim/final transcript merging

The browser still uses `speechSynthesis` for spoken follow-up questions in conversation / auto mode. That is output-only and is not a nutrition source of truth.

## Security

The long-lived Gemini API key is not placed in the public GitHub Pages client. Audio requests continue to use the existing server-side GAS bridge.

## Why this is not `gemini-3.5-transcribe-live` yet

The official Gemini Live client-to-server design requires a server-created short-lived ephemeral token. The current PFC GAS bridge has no deployed ephemeral-token issuer. Exposing a long-lived Gemini API key in GitHub Pages would be unacceptable.

Therefore Clean 1.2 removes browser ASR immediately using Gemini audio understanding through the existing secure bridge. The later Live upgrade should replace only the transport layer with:

`microphone -> ephemeral token -> gemini-3.5-transcribe-live WebSocket -> transcript -> existing memo parser -> Food Master`

No UI or nutrition architecture rewrite should be needed for that upgrade.

## Runtime limits

- automatic silence finalize: ~3.2 seconds after detected speech
- no-speech timeout: 12 seconds
- maximum recording: 35 seconds
- client audio size guard: 6 MiB
- microphone constraints: mono, echo cancellation, noise suppression, automatic gain control where supported
