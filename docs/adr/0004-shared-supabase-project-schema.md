# ISF Uses the Shared github-jinhoOps Supabase Project

Status: Accepted (2026-10-23)

## Decision

ISF moves from its own Supabase project (`fqongmuyfmxjqmefekbg`,
IndividualSavingsFlow) into the shared `github-jinhoOps` project
(`olqdftjssrzqvcindekh`), where each static-site repository owns its own schema.

| Before | After |
| --- | --- |
| `public` | `individualsavingflow` (API schema, exposed by PostgREST) |
| `private` | `individualsavingflow_private` (not exposed) |
| `workspace_rpc_owner`, `lounge_rpc_owner`, `lounge_maintenance_owner` | `isf_` prefix |
| bucket `result-card-shares` | `isf-result-card-shares` |
| functions `result-card-share`, `cleanup-result-card-shares` | `isf-` prefix |
| cron `lounge-notification-cleanup`, `lounge-ranking-refresh` | `isf-` prefix |

The migration files were rewritten in place to the new names, so the
repository describes the shared project. The old project's history stays in Git.
The schema name keeps the existing `individualsavingflow` spelling, which was
already exposed in the shared project.

## Rationale

The Supabase Free plan limits active projects per organization. The other
repositories already share one project and separate their data by schema.
Database objects, roles, buckets, Edge Functions, function secrets, Vault
names and cron jobs are project-wide, so ISF names carry a repository prefix.

Keeping a separate private schema preserves the existing boundary: helper
functions and internal tables are never reachable through the Data API.
Supabase grants default privileges on `public` only, so
[202609060001](../../supabase/migrations/202609060001_individualsavingflow_schema.sql)
gives the API schema the same defaults. Every table and function then
receives the same explicit grants and revokes as before.

## Consequences

- Clients select the schema: `db: {schema: 'individualsavingflow'}` in the
  browser client and in the Edge Function service client.
- Authentication is shared with the other repositories. Accounts that already
  existed in the shared project under the same email keep that account's ID,
  and their ISF rows were remapped to it.
- Free-plan database size, storage size and egress are now shared. The
  result-card storage budget already counts other buckets. The Lounge row
  caps were sized for a dedicated 500 MB database.
- Do not run `supabase db push` against the shared project. Its migration
  history table would be shared with the other repositories. Apply new
  migrations explicitly, as described in the
  [operations guide](../supabase-account-setup.md#2026-10-23-공유-프로젝트-이관).
- Security-definer functions no longer include `public` in `search_path`,
  because other repositories may create objects there.
