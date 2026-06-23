# ChaosToolbox Processing Core Plan

## Solution Approach

Take the current local-first app and turn the backend into a processing core, not a pile of one-off handlers. Keep the existing Vue client and SQLite-based storage, but introduce a shared artifact/relations layer, add real search and review workflows, and make jobs and AI outputs auditable.

## Ordered Steps

1. Break the monolithic server entrypoint into modules.
   - Touch: `server/index.ts`, new `server/app.ts`, and small feature modules under `server/modules/`.
   - Move routing and orchestration out of `server/index.ts` so artifact, search, review, job, and connector logic have separate homes.
   - Verification: `rg -n "app\.(get|post|put|patch|delete)" server/index.ts` should shrink, and `npm test` should still pass for the existing API tests that cover the moved routes.

2. Add the shared Artifact and Relation core.
   - Touch: new DB/schema files under `server/db/` and feature code under `server/modules/artifacts/`.
   - Model the common fields once, then let sources, notes, tasks, emails, RSS items, assets, decisions, projects, and people reference that core.
   - Verification: add tests for artifact creation, relation creation, and any persistence/query helpers that replace the current ad hoc paths.

3. Add global search with SQLite FTS5 plus saved searches.
   - Touch: `server/db/`, `server/modules/search/`, and the Vue search UI if needed.
   - Index the artifact text once, support basic facets, and store a small set of saved searches for inbox/review/project workflows.
   - Verification: add a search test that proves FTS-style matching and at least one saved-search query path.

4. Build the review workflow around the processing states.
   - Touch: `server/modules/review/`, `src/components/AppDashboard.vue`, and the views that show notes/sources/inbox.
   - Expose the queue states and K/R/A actions directly so users can move items through the pipeline instead of treating inbox entries as a dead list.
   - Verification: add a UI or route-level test that proves the queue is visible and the review actions still update the underlying item state.

5. Add dedicated Decision and Project views.
   - Touch: new module code in `server/modules/decision/` and `server/modules/project/`, plus the matching client views if needed.
   - Keep them first-class instead of forcing them through generic note text.
   - Verification: tests should confirm these records can be created, listed, and linked to artifacts.

6. Expand job detail and keep AI optional.
   - Touch: `server/jobQueue.ts`, job routes, and the job panel in the client.
   - Surface logs, timing, retries, and linked artifacts; keep AI runs as tracked jobs with clear inputs and outputs, not as hidden side effects.
   - Verification: existing job tests still pass, and a new test should cover the richer job payload or detail view.

## Risks

- `server/index.ts` is currently dense, so refactors need tight slices to avoid breaking unrelated endpoints.
- SQLite FTS5 support needs to be confirmed against the current runtime before the search layer is locked in.
- The memo asks for broad conceptual changes, but the first pass should stay local-first and avoid syncing or CRDT design work.
