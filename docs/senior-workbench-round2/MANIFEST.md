# Workbench Manifest

Repository: `TAMA-FIT/pfc-mirror`

Baseline commit: `72d65255705ac0681a06dc993a47b50467a20c14`

Workbench branch: `workbench/v1.6.0-senior-round2`

Production version at baseline: `v1.5.1`

## Production files intentionally not modified in this round

- `clean/src/main.js`
- `clean/src/storage.js`
- `clean/src/nutrition/catalog.js`
- `clean/src/nutrition/engine.js`
- `clean/src/ai/**`
- `clean/src/voice/**`
- `clean/assets/**`
- root bootstrap files

## Candidate modules

- `docs/senior-workbench-round2/candidate-modules/features/targets.js`
- `docs/senior-workbench-round2/candidate-modules/features/alcohol.js`
- `docs/senior-workbench-round2/candidate-modules/dev/realistic-decoy.js`

## Safety invariants

- no production voice change
- no storage migration
- no main merge
- no AI-generated nutrition authority
- no deletion of existing user data
