# Test Checklist

## Automated workbench tests

Run:

`node docs/senior-workbench-round2/tests/run-all.mjs`

Covers:

- target preset arithmetic
- alcohol visibility/model
- realistic history variation
- alcohol-day generation
- realistic body fluctuation
- dummy-only deletion helper

## Integration tests for later production pass

### Target settings
- 1200/1600/2000/2400 selectable
- P/F/C recalculated from selected mode
- reload persistence
- close/back behavior correct

### Alcohol
- no A card on alcohol-free day
- A appears automatically when A>0
- history/backup preserves A
- removing all alcohol removes A presentation

### Record cards
- food name/amount/kcal/PFC readable
- A only where relevant
- edit/delete large enough
- 360-430px no overflow

### Storage
- existing tf_dat/tf_tg/tf_hist/tf_body readable
- no destructive migration

### Food ID
- recognized foods still use validated Food ID
- nutrition values remain mechanically reproducible

### Voice
- production voice core remains unchanged in this workbench round
