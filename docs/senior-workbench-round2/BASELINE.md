# Baseline

Canonical repository: `TAMA-FIT/pfc-mirror`

Baseline commit: `72d65255705ac0681a06dc993a47b50467a20c14`
Visible production version: `v1.5.1`

Relevant existing contracts verified before this workbench:

- `clean/src/main.js` renders current Home/History/Body/Settings/Voice UI.
- `clean/src/storage.js` preserves legacy localStorage keys including `tf_dat`, `tf_tg`, `tf_fav`, `tf_fav_settings`, `tf_my`, `tf_hist`, `tf_body`.
- `clean/src/nutrition/engine.js` already carries `P/F/C/A/Cal` and validates records against a trusted Food ID.
- `clean/src/nutrition/catalog.js` separates trusted exact resolution from fuzzy candidate search.
- base Food Master data already contains alcohol rows with `A` values.

This round intentionally avoids production-file edits. It is a workbench contract for the following integration pass.
