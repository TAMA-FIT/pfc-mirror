# PFC Mirror Current Development State

Last memory refresh: 2026-09-11 JST

## Canonical rule

Fresh GitHub `main` is always canonical for code and version state. This file records the current architecture, verified milestones, known limits, and release gates. If this file conflicts with Fresh `main`, Fresh `main` wins.

## Public runtime

- Public URL: `https://tama-fit.github.io/pfc-mirror/`
- Production before the current candidate: **v1.7.20**, main `4f60de792ff77653190fe06e5cda5b65ff92c885`
- Current candidate: **v1.7.21 semantic-to-grounded nutrition search**
- Candidate branch: `fix/v1721-semantic-official-search`
- Root `index.html` and `clean/index.html` are both active version/cache surfaces and must move together.

## Current Gemini Live architecture

Gemini Live remains Free Tier oriented. Google Search is NOT attached to the Gemini 3.1 Live session.

```text
microphone
  -> Gemini 3.1 Flash Live
       semantic interpretation / vague-language understanding
       update_meal_draft Function Calling
  -> LiveMealDraft
  -> generic exact Food Master/MEXT resolution when appropriate
  -> unresolved branded/product item
  -> GAS nutritionLookup
  -> Gemini 2.5 Flash + Google Search Grounding
  -> current official product identification/correction
  -> verified official P/F/C/kcal
  -> card preview
  -> explicit user Register
  -> deterministic record write
```

A second transcription stream remains dedicated to visible Japanese transcription. Permanent Gemini API keys stay in GAS Script Properties; the browser receives short-lived Live tokens and never receives the permanent key.

## v1.7.21 semantic-to-grounded design

The key rule is: **AI may infer the product; AI may not invent the product nutrition.**

Examples:

- `サムライマック 普通のやつ` -> Live may infer a concrete current/likely Samurai Mac candidate as a search hypothesis.
- That hypothesis is not trusted nutrition evidence. It is sent with user context and candidate names to the separate Gemini 2.5 Flash search worker.
- Search worker checks the current official lineup and may correct an obsolete/end-of-sale candidate before reading nutrition.
- `マックのポテトL` should preserve McDonald's + L-size semantics instead of collapsing early to generic `ポテト`.
- If a branded product remains ambiguous after search, refine the candidate or ask one short clarification instead of silently inventing P/F/C.

The app sends `foodName`, `contextText`, and `candidateNames` to the GAS search worker. Search cache keys include all three, so changing the semantic candidate does not reuse an unrelated cached result.

## Nutrition resolution priority

The intended precedence for values actually shown/saved is:

1. **User-declared package/menu nutrition (`user-label`)** — exact values explicitly read/provided by the user.
2. **Verified official Web nutrition (`official-web`)** — manufacturer/chain/brand official search result. This outranks a generic Food Master match for the same branded product.
3. **Trusted local DB (`trusted-db`)** — Food Master / MEXT for generic foods and deterministic local matches.
4. **AI estimate (`ai-estimate`)** — last resort only for foods/recipes where official product data does not exist or cannot reasonably apply. AI estimate must not override verified official data or trusted DB.

This precedence is implemented in `clean/src/nutrition/evidence-v1716.js` even though the historical filename remains unchanged.

## GAS nutrition search worker

Current candidate contract: `PFC_GAS_NUTRITION_LOOKUP_V13_1_FLEX` using `gemini-2.5-flash` + `google_search`.

Security / quota:

- permanent API key remains in Script Properties (`GEMMA_API_KEY` / compatible fallback)
- key is never returned to the browser
- default safety cap 450 searches/day
- hard cap 500/day

Search behavior:

- vague user wording is interpreted semantically rather than used as a literal search query
- Live-proposed product names are hypotheses, not facts
- old/end-of-sale names trigger a search for the current official lineup
- multiple search steps are allowed: identify current product first, then verify official nutrition
- official manufacturer/chain/product pages, official PDFs, and official nutrition tables are preferred
- numeric P/F/C/kcal may not be filled from model memory
- non-official blogs/social/wiki/calorie databases cannot become `verified`
- Google Search grounding metadata is required
- do not require grounding chunk URLs themselves to contain the official domain because Google may return redirect/tracking URIs
- source URL/domain supplied for the verified record must still be HTTPS, internally consistent, and non-blocklisted
- PFC/kcal check rejects only obvious numerical contradictions; normal labeling/rounding/fiber differences are tolerated

Successful results include `resolutionNote`, provenance, product identity, serving label, P/F/C/kcal, model, and verification timestamp.

## Live card / readiness contract

The Live card is the user-visible source of truth before registration.

For a ready item the card must show:

- resolved/display product name
- amount / serving basis
- source/status
- kcal and P/F/C preview

Verified official search results use `official-web` evidence and should display the official source label. The Register button is enabled only when `draft.isReady()` is true. Registration uses the same DB/evidence object shown in the card.

For branded products, an official-search miss must not immediately become a plausible-looking AI estimate. The Live recovery path should first refine product identity / size or ask one concise clarification.

## Browser / microphone lifecycle

Preserve the v1.7.19+ cleanup behavior:

- opening Live pushes a same-page history state
- browser/Android Back closes Live first
- cleanup closes transcriber and Live WebSocket and stops microphone tracks
- `pagehide` and `beforeunload` remain emergency release paths
- do not auto-close on `visibilitychange` unless the owner explicitly changes that policy

## Release gate

Do not release based only on prompt/schema/unit tests. Validate the claimed user outcome end-to-end-ish:

```text
user speech
 -> semantic product interpretation
 -> Tool Call / app recovery
 -> official lookup when applicable
 -> current product identity
 -> correct source/serving/PFC visible in card
 -> draft ready=true only when appropriate
 -> Register enabled
 -> saved record matches preview
 -> leaving Live releases microphone/resources
```

Required v1.7.21 scenarios include:

- `サムライマック 普通のやつ` -> semantic concrete hypothesis -> official current-product search; obsolete product names must not become authoritative nutrition
- `マックのポテトL` -> preserve brand/size; official verified values may override a generic Food Master row
- `マックのスプライトM` -> official search first; no ungrounded fat/carbohydrate fabrication
- generic `白米 普通` -> trusted local Food Master path without unnecessary Web lookup
- package P/F/C -> `user-label`
- unknown local/home-made dish -> AI estimate only as last resort
- Browser Back -> microphone/resources released

CI success is not a substitute for Android real-device verification, but all changed runtime/source-order/search-contract paths must pass CI before merge.
