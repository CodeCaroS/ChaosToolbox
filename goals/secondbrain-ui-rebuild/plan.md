# Second Brain UI Rebuild Plan

## Solution Approach

Rebuild the UI around a Command Center without changing backend APIs. Keep the existing Vue/DaisyUI stack, promote Second Brain Git to a top-level view, add one small Git component, and make the dashboard point users at inbox, notes, sources, and Git state.

## Ordered Steps

1. Add a top-level Second Brain Git view.
   - Touch: `src/components/useAppShell.ts`, `src/components/AppShell.vue`, `src/components/AppShell.template.html`.
   - Change `navItems` to include a `git` item and remove Git from `sourceTools`.
   - Wire `activeView === 'git'` to a dedicated component.
   - Verification: update/add a source-level test that asserts `label:"Second Brain Git"` appears in nav and no longer appears in source tools.

2. Extract the existing Git UI into a small guided component.
   - Touch: new `src/components/AppGit.vue`, `src/components/AppShell.vue`, `src/components/AppShell.template.html`.
   - Props/actions: `gitStatus`, `gitForm`, `gitBusy`, `gitResult`, `forcePushConfirmed`, `syncSecondBrain`, `commitSecondBrain`, `pullSecondBrain`, `pushSecondBrain`.
   - UI: primary Sync button, status summary, commit message input, Pull/Commit/Push buttons, remote/branch fields, force-with-lease checkbox and disabled Force Push until checked.
   - Verification: text/regex test for the guided controls and force-push guard.

3. Turn the dashboard into the Command Center.
   - Touch: `src/components/AppDashboard.vue`, `src/components/AppShell.template.html`, maybe `src/components/useAppShell.ts`.
   - Pass `gitStatus`, `gitBusy`, and a Git navigation/action event into the dashboard.
   - Add a compact Second Brain panel showing branch, changed/ahead/behind/conflict/auth state, and buttons for Sync and Open Git.
   - Keep inbox/source cards on the dashboard, but make them secondary to the daily-work + Git summary.
   - Verification: dashboard test asserts Git status and Git navigation/action wiring are present.

4. Make Notes and Sources easier to scan with layout-only changes.
   - Touch: `src/components/AppShell.template.html`, existing CSS in `src/style.css` only if needed.
   - Notes: keep the tree/detail model, tighten controls into one toolbar, keep new-note/edit flows unchanged.
   - Sources: keep list/detail, keep RSS/OPML/E-mail/TikTok tools, remove Git from that tool list, and make the source-tool picker easier to scan.
   - Verification: existing source links layout tests still pass; add a simple assertion that Sources no longer owns Git.

5. Run checks.
   - Commands: `npm test`, `npm run build`.
   - If the build fails on unrelated existing dirty-worktree changes, document the exact failure and keep the UI plan changes scoped.

## Risks

- `src/components/useAppShell.ts` is minified/einzeilig, so manual edits are brittle. Prefer the smallest text replacement or reformat only if necessary for the touched section.
- `AppShell.template.html` is already large. Moving Git into `AppGit.vue` keeps the template below the repo's 500-line file-size test.
- The repo is currently dirty. Do not revert unrelated changes.
