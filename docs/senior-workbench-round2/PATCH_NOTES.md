# Production Integration Notes

## Target presets

Replace the current senior settings pattern that asks for direct `cal/p/f/c` entry with preset selection. Reuse existing target state and `tf_tg`; do not migrate user data.

## Alcohol

Do not add a second nutrition calculator. Existing records already carry `A`; production UI should derive visibility from current records (`summary().a > 0`).

## Manager

Keep decoy generation developer-only and mark every generated row `isDummy:true`. Production integration should prefer actual Food Master IDs for decoy foods where practical, but decoy data must never become nutrition authority for real records.

## Voice

No production voice change in this round. The Android capture-lifetime issue remains a separate architecture task.
