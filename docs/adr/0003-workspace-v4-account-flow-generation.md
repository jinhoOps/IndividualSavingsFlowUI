# Workspace v4 Account-flow Generation

Status: Accepted

## Decision

The planned Account Map transfer contract is introduced through a new
whole-workspace generation, `isf-workspace-v4`. Workspace v3 remains an
untouched, read-only rollback and migration source. The repository cutover,
including lock namespaces and backup format v3, is a separate atomic change.

`WorkspaceDocumentV4` accepts Account Map applied v2/v3 and draft v1/v2. A
workspace envelope migration preserves the nested Account Map version; only a
user-confirmed Account Map flow save upgrades the affected nested state.

## Rationale

The Account Map transfer contract changes a nested durable product boundary.
Reusing the v3 key would allow a newer writer to make data unreadable to an
already-open v3 deployment, and would remove the reliable rollback source.
Keeping the generations separate lets a rolled-back v3 deployment continue to
read its original bytes, while a returning v4 deployment can read its v4
record.

An existing v4 record is canonical. An invalid v4 record must be surfaced as
invalid rather than falling back to v3 or a retired v1/v2 source; fallback
would silently replace an explicit current-generation failure with older data.

## Isolation and backup

The v4 repository uses a distinct destination lock. Its first conversion also
coordinates with the v3 source lock while snapshotting v3; ordinary v4 writes
use only the v4 lock. Neither path writes, normalizes, deletes, or overwrites
v3 or the supported retired source.

Whole-workspace backup format v3 follows workspace v4. Backup formats 1 and 2
remain read-only import sources that are fully converted and validated before a
single v4 replacement write.
