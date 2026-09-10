# Decisions

## D-001 — Refine once before push

The first ZIP proved the local-first workflow but was still prototype-heavy. Round 2 adds explicit candidate modules, automated tests, manifest, and review notes before branch review.

## D-002 — Branch only, no main merge

Push target: `workbench/v1.6.0-senior-round2`.
Production `main` remains untouched.

## D-003 — Voice core is frozen

This round does not modify production voice code. Android SpeechRecognition lifecycle requires a separate architecture decision.

## D-004 — Food ID remains the nutrition boundary

AI may interpret language. Nutrition values must continue to come from validated Food ID -> Food Master.

## D-005 — Target presets reuse existing state

Target presets populate existing `cal/p/f/c/mode/label` fields. No new target storage schema is required.

## D-006 — Alcohol presentation is data-driven

Do not require a user-facing alcohol mode toggle merely to reveal A. If records contain A>0, show alcohol automatically.

## D-007 — Manager data must be removable

Every developer-generated record/row carries `isDummy:true` so real user data can be preserved.
