import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const appDashboard = readFileSync("src/components/AppDashboard.vue", "utf8");
const appGit = readFileSync("src/components/AppGit.vue", "utf8");
const appTemplate = readFileSync("src/components/AppShell.template.html", "utf8");

test("dashboard is a command center with git status and git actions", () => {
  assert.match(appDashboard, /Command Center/);
  assert.match(appDashboard, /Second Brain Git/);
  assert.match(appDashboard, /Review Queue/);
  assert.match(appDashboard, /gitStatus\?\.branch/);
  assert.match(appDashboard, /gitStatus\?\.files\.length/);
  assert.match(appDashboard, /emit\('syncGit'\)/);
  assert.match(appDashboard, /emit\('navigate', 'git'\)/);
  assert.match(appTemplate, /@sync-git="syncSecondBrain"/);
  assert.match(appTemplate, /@set-review-status="setReviewStatus"/);
  assert.match(appTemplate, /activeView === 'projects' \|\| activeView === 'decisions'/);
  assert.match(appTemplate, /job\.createdAt/);
  assert.match(appTemplate, /job\.updatedAt/);
  assert.match(appTemplate, /JSON\.stringify\(job\.input/);
  assert.match(appTemplate, /JSON\.stringify\(job\.result/);
  assert.match(appTemplate, /job\.logs\?\.slice\(-3\)/);
  assert.match(appTemplate, /\/api\/jobs\/\$\{job\.id\}\/retry/);
});

test("git screen is guided and keeps force push guarded", () => {
  assert.match(appGit, /Sync your notes repo/);
  assert.match(appGit, /v-model="gitForm\.message"/);
  assert.match(appGit, /@click="emit\('pull'\)"/);
  assert.match(appGit, /@click="emit\('commit'\)"/);
  assert.match(appGit, /@click="emit\('push', false\)"/);
  assert.match(appGit, /:disabled="gitBusy \|\| !forcePushConfirmed"/);
  assert.match(appTemplate, /<AppGit/);
  assert.match(appTemplate, /v-model:force-push-confirmed="forcePushConfirmed"/);
});
