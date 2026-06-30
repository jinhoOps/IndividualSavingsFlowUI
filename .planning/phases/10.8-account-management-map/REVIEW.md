---
phase: 10.8-account-management-map
reviewed: 2026-06-30T00:00:00Z
depth: deep
files_reviewed: 11
files_reviewed_list:
  - apps/account-map/app.js
  - apps/account-map/index.html
  - apps/account-map/styles.css
  - apps/account-map/modules/dom.js
  - apps/account-map/modules/draft-builder.js
  - apps/account-map/modules/map-renderer.js
  - apps/account-map/modules/state.js
  - apps/account-map/modules/step1-connector.js
  - tests/account-map.spec.ts
  - src/entries/account-map.ts
  - shared/components/app-header.js
findings:
  critical: 1
  warning: 2
  info: 0
  total: 3
status: issues_found
---

# Phase 10.8: Code Review Report

**Reviewed:** 2026-06-30T00:00:00Z
**Depth:** deep
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the current Account Map subsystem end to end: route entry, route shell, draft import, state persistence, SVG rendering, drag behavior, fixed-payment candidates, header integration, and Playwright coverage. The implementation satisfies the main happy-path requirements and existing tests pass, but there are still correctness gaps around delimiter-based selection IDs, failed local persistence, and pointer-cancel rollback.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Colon-containing account or relationship IDs cannot be selected correctly

**File:** `apps/account-map/modules/dom.js:51`

**Issue:** Selection state is serialized as `${type}:${id}` in `apps/account-map/app.js:133`, but detail rendering decodes it with `const [kind, id] = selectedId.split(":")`. Main data IDs are imported as user/domain data and are not normalized to exclude colons. Any account ID or derived relationship ID containing `:` will be truncated during detail lookup, so selecting the visible node or relationship renders "not found" or the wrong item.

**Why it matters:** Account Map is supposed to import Main-owned account data without imposing a new ID grammar. A valid imported ID such as `bank:kakao` produces `account:bank:kakao`, which `split(":")` reads as `kind="account"` and `id="bank"`. That breaks selection detail, relationship editing, and any workflows depending on persisted `selectedId`.

**Fix:**

```javascript
const separatorIndex = selectedId.indexOf(":");
const kind = separatorIndex >= 0 ? selectedId.slice(0, separatorIndex) : "";
const id = separatorIndex >= 0 ? selectedId.slice(separatorIndex + 1) : "";
```

Apply the same decode helper anywhere `selectedId` is parsed, or store selection as structured data such as `{ type, id }` instead of a delimiter-encoded string.

## Warnings

### WR-01: Failed `IsfStorageHub.saveLocal` calls are treated as successful persistence

**File:** `apps/account-map/modules/state.js:40`

**Issue:** `saveLocalDraft` returns immediately whenever `hub.saveLocal` exists, but the shared storage API returns `false` when `localStorage.setItem` fails. Account Map ignores that return value and does not try the fallback path or notify the caller.

**Why it matters:** Dragged positions, candidate accept/exclude decisions, and relationship edits can appear saved in memory while never reaching local storage. On reload, the user loses those Account Map-only changes even though the UI gave success feedback.

**Fix:** Treat `false` as a failed save, try the fallback only when it is meaningful, and surface failure to the app so it can show feedback.

```javascript
const result = hub?.saveLocal?.(ACCOUNT_MAP_STORAGE_KEY, data);
if (result !== false && result !== undefined) return true;

try {
  localStorage.setItem(ACCOUNT_MAP_STORAGE_KEY, JSON.stringify(data));
  return true;
} catch (error) {
  return false;
}
```

Then have `saveToStorage` throw or return a boolean that event handlers can use to avoid showing successful persistence messages after a failed save.

### WR-02: Pointer cancel leaves the node visually at an unpersisted partial drag position

**File:** `apps/account-map/modules/map-renderer.js:465`

**Issue:** During drag, pointer moves mutate the local `positions` map. `pointercancel` calls `finishDrag({ persist: false })`, but `finishDrag` only skips persistence; it does not restore the node's original coordinates before redrawing. The current tests verify storage is not updated, but the displayed map can still show the cancelled drag location until another full render recomputes layout.

**Why it matters:** On touch devices, pointer cancellation is a normal browser gesture path. Showing an unpersisted position after cancellation creates a mismatch between the visible map and stored state, then causes the node to jump later when another render occurs.

**Fix:** Capture the node's original position in `dragState` on `pointerdown`, and restore it when `persist` is false.

```javascript
dragState = {
  nodeId: node.id,
  originalPosition: { x: position.x, y: position.y },
  // existing fields...
};

if (!persist && dragState.originalPosition) {
  positions.set(nodeId, dragState.originalPosition);
}
```

Add a Playwright assertion that the node transform after `pointercancel` equals the pre-drag transform, not only that local storage is unchanged.

## Strengths

- Account Map is a dedicated route through `src/entries/account-map.ts` and the header route integration does not import Portfolio modules.
- Main data import writes to `isf-account-map-v1` and the reviewed draft builder does not mutate the Main local storage object.
- Overview rendering uses SVG text nodes and DOM `textContent`, so imported unsafe labels render as text rather than markup in the Account Map path.
- Existing Playwright coverage exercises route independence, import, overview amount hiding, detail amount reveal, candidate accept/exclude, drag persistence, auto-layout size stability, unsafe text, and mobile visibility.

## Recommendations

- Add regression coverage for IDs containing `:` and other delimiter-like characters.
- Add a storage failure test by stubbing `window.IsfStorageHub.saveLocal` to return `false`.
- Extend the pointer-cancel test to assert visual rollback, not just absence of persisted positions.

## Assessment

Ready to merge? **With fixes.** The subsystem meets the core happy path and current tests pass, but delimiter-based selection breaks valid imported IDs and persistence/cancel edge cases can lose or misrepresent user changes.

## Follow-up Resolution

Resolved in `4886f20 fix(account-map): address review findings`.

- Fixed delimiter-safe selection decoding for account and relationship IDs containing `:`.
- Added save failure propagation and user feedback for import, candidate actions, relationship edits, and drag position persistence.
- Restored the original node position on pointer cancellation.
- Added Playwright regressions for colon-containing IDs, storage failure feedback, and pointer-cancel visual rollback.

---

_Reviewed: 2026-06-30T00:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
