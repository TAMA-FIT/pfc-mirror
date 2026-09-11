# Gemini Live UX — v1.7.14

This file records the product decisions approved for the Live meal-entry flow. Fresh GitHub `main` remains canonical for implementation/version state.

## Approved behavior

1. **Partial Draft first**
   - As soon as Gemini understands one or more food names, it should call `update_meal_draft` before asking follow-up questions or speaking a reply.
   - Missing quantity, unit, meal bucket, or chicken-breast skin state must not delay the initial cards.
   - Multiple foods from one utterance should normally be added in one tool call.
   - Later quantity/variant corrections should update the same app-owned `ref`, not create duplicate cards.

2. **Meal bucket defaults from current device time**
   - If the user explicitly says breakfast/lunch/dinner/snack or gives relevant past-time context, that explicit context wins.
   - Otherwise Gemini should omit `meal`; `LiveMealDraft` assigns the app's current-time default via `autoMeal()`.
   - Gemini should not routinely ask `何時に食べましたか` just to choose a meal bucket.

3. **Longer turn-end silence**
   - Live VAD `silenceDurationMs` is 1400 ms, up from 900 ms.
   - The physical end of an utterance remains VAD-driven; semantic completion remains Gemini's responsibility.

4. **Final confirmation**
   - When the tool result reports `ready=true`, Gemini should not read the entire meal list aloud again.
   - Preferred final line: `画面の内容で合っていれば登録ボタンを押してください。`
   - Registration remains explicit and button-driven.

## Architecture preserved

- Gemini handles natural semantic interpretation and conversation.
- Gemini must not author P/F/C/A/kcal, Food IDs, or nutrition truth.
- Deterministic resolver / Food Master / nutrition engine remain authoritative.
- Chicken breast remains the only explicit product-specific qualifier exception: skin state must not be guessed.
- GAS V12, dedicated `gemini-3.5-transcribe-live`, AudioWorklet playback, normal text AI, legacy storage, Food Master, and nutrition engine are not changed by this UX update.
