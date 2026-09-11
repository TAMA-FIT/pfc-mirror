# v1.7.20 Grounded Nutrition Search — Handoff

Date: 2026-09-11 JST

## Canonical status

Fresh `main` remains production v1.7.19 until GAS V13 is deployed and PR #47 is explicitly released.

Candidate branch: `feat/v1720-grounded-nutrition-search`
Candidate PR: #47 (kept Draft intentionally)
Candidate public version after release: v1.7.20

## Why

Real-device v1.7.19 proved that ungrounded Gemini internal nutrition knowledge can produce materially wrong P/F/C values. The clearest example was Sprite M showing non-zero fat and very low carbohydrate. Therefore model-generated nutrition must not be the normal resolution path.

## Resolution order

1. User-declared package/menu P/F/C (`user-label`).
2. Existing trusted local Food Master / MEXT resolution.
3. For unresolved items only: server-side Gemini 2.5 Flash + Google Search, restricted to official manufacturer / restaurant / brand sources.
4. Trusted local candidates when search cannot verify an official result.
5. `ai-estimate` only as the last fallback.

Gemini 3.1 Flash Live remains search-free. It handles natural conversation and semantic food understanding only.

## Search architecture

Browser -> existing GAS endpoint with `taskType: nutritionLookup` -> GAS Script Properties API key -> `gemini-2.5-flash:generateContent` with `google_search` -> official-source validation -> browser receives only the normalized nutrition result, never the permanent API key.

Successful official results are recorded as `official-web` and include source label, URL, serving basis, P/F/C, kcal, and verification metadata.

## Free-tier / abuse guard

GAS patch defaults to 450 search requests/day and hard-clamps the configured limit to 500/day. This is intentionally below the current Gemini 2.5 Flash / Flash-Lite shared free Google Search allowance. Successful official lookups are cached in the browser for 30 days (max 80 entries) to reduce repeated searches.

## Mandatory backend deployment before merge

The repo connection cannot directly deploy the user's existing Apps Script project.

Before PR #47 can merge:

1. Open the same Apps Script project currently serving PFC GAS Live Token V12.
2. Add the contents of `docs/gas/PFC_GAS_V13_NUTRITION_LOOKUP_PATCH.gs` as a new `.gs` file.
3. At the very top of the existing `doPost(e)` body add:

```js
var pfcNutritionResponse = pfcTryNutritionLookupV13_(e);
if (pfcNutritionResponse) return pfcNutritionResponse;
```

4. Keep the existing Script Property `GEMMA_API_KEY` unchanged.
5. Optional: `PFC_NUTRITION_LOOKUP_DAILY_CAP`; absent defaults to 450 and code never permits more than 500.
6. Deploy a new version of the same Web App, preserving the current `/exec` URL.
7. Then verify `nutritionLookup` against known products before marking PR #47 Ready and merging.

## CI status before GAS deployment

At candidate head `c9487ef619dc8a41611021745c49657f6f7de73c`, all PR checks passed:

- PFC smoke check
- PFC home UI check
- PFC nutrition resolution check
- PFC Live v1.7.20 grounded search check

These checks validate code/contracts only. Actual Google Search grounding cannot be considered released until GAS V13 is deployed and real endpoint/device tests pass.
