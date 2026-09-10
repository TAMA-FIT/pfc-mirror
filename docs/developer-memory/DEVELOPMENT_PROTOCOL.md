# PFC Mirror Development Protocol

## Purpose

Use this protocol to avoid rebuild-from-scratch regressions, stale-memory edits, duplicate implementation layers and premature production changes.

## Default workflow

### Phase 1 — Understand before editing

1. Reproduce/describe the symptom or requested behavior in chat.
2. Separate UX requirements from implementation causes.
3. Inspect only the relevant current production files read-only.
4. Describe the target UX and architecture in prose.
5. Explicitly identify:
   - what stays unchanged
   - what is removed
   - what changes
   - protected boundaries
   - likely failure modes / side effects
6. Get user agreement before implementation when the change is structural.

### Phase 2 — Fresh snapshot

1. Fetch Fresh `main` from GitHub.
2. Pin the exact baseline commit SHA.
3. Fetch the relevant files from that exact ref.
4. Record file/blob SHAs when useful.
5. Never assume a version/branch state from an earlier chat.

### Phase 3 — Chat/local sandbox

For meaningful features, build an isolated sandbox/workpack before GitHub runtime edits.

Preferred structure:

```text
feature-sandbox/
├─ README.md
├─ BASELINE.md
├─ docs/
│  ├─ SPEC.md
│  ├─ DECISIONS.md
│  ├─ ARCHITECTURE.md
│  ├─ TEST_MATRIX.md
│  └─ SCENARIOS.md
├─ candidate/
├─ tests/
└─ TEST_RESULTS.txt
```

Use mock clients/state machines/contracts first when external APIs are involved. Run syntax and behavioral tests locally. A sandbox may be delivered as a ZIP in chat and can evolve through multiple iterations without touching production.

### Phase 4 — Production candidate

Only after sandbox behavior is stable:

1. Re-fetch Fresh GitHub `main`.
2. Build the production candidate against the latest exact runtime.
3. Prefer a new implementation branch rather than altering the design/workbench branch.
4. Keep changes small and independently testable.
5. Add automated contract tests for the boundaries being changed.
6. Push branch.
7. Open PR.
8. Inspect compare/diff before merge.

### Phase 5 — Human/device review

It is acceptable to push a development branch before human review. The app is still in development and not distributed to users.

However:

- branch push is not production approval
- automated tests are not real-device verification
- never claim Android/iPhone/browser behavior was verified unless it was actually tested
- `main` merge is the real release gate

### Phase 6 — Merge/release

Before merging:

1. Re-check that `main` has not moved unexpectedly.
2. If it moved, inspect the intervening commits before merging.
3. Confirm there is no duplicate runtime implementation.
4. Confirm protected files were not modified accidentally.
5. Confirm CI/tests are green.
6. Merge only the intended candidate.
7. Verify both root and clean entrypoints if relevant.
8. Update this developer memory after the release.

## Important lessons already learned

### Root entrypoint is real

The public root `index.html` directly loads `clean/` assets/runtime. Updating only `clean/index.html` can leave the public URL unchanged.

### Never duplicate an already-landed implementation

During the v1.6 work, `main` moved while a separate candidate branch was being prepared. The correct response was to inspect the new `main`, close the redundant PR, and build only the necessary stability hotfix.

### DOM observer risk

A MutationObserver that modifies the same observed subtree can self-trigger indefinitely. Patches must be idempotent, avoid unnecessary DOM writes, and be reviewed for observer loops.

### Documentation-only memory is safe

Files under `docs/developer-memory/` must never be imported by runtime code. They may live on `main` because the user explicitly requested persistent repository memory, but normal feature implementation still follows branch/PR discipline.

## Protected boundaries unless explicitly reopened

- `clean/src/voice/input.js` current normal voice implementation
- AI transport for normal voice, unless the task specifically targets it
- `clean/src/nutrition/catalog.js` strict Food ID resolver contract
- `clean/src/nutrition/engine.js` trusted nutrition calculation contract
- existing `tf_*` localStorage keys and user data
- backup/restore compatibility

## Communication rule

Be precise about what was actually done:

- “created locally” != pushed
- “pushed branch” != merged
- “merged” != device-tested
- “source updated” != verified as deployed in the browser cache

Avoid claiming success beyond the evidence available.
