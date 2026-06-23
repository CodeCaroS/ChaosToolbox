import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const appShell = readFileSync("src/components/useAppShell.ts", "utf8");
const appTemplate = readFileSync("src/components/AppShell.template.html", "utf8");
const appShellVue = readFileSync("src/components/AppShell.vue", "utf8");
const appDashboard = readFileSync("src/components/AppDashboard.vue", "utf8");
const appInbox = readFileSync("src/components/AppInbox.vue", "utf8");
const serverIndex = readFileSync("server/index.ts", "utf8");
const serverApp = readFileSync("server/app.ts", "utf8");

test("sources owns source capture tools and git is top level", () => {
  assert.doesNotMatch(appShell, /Git Import/);
  assert.match(appShell, /label:"Links"/);
  assert.match(appShell, /label:"RSS Feed"/);
  assert.match(appShell, /label:"OPML Import"/);
  assert.match(appShell, /label:"E-Mail Import"/);
  assert.match(appShell, /label:"TikTok Note"/);
  assert.match(appShell, /label:"Second Brain Git"/);
  assert.doesNotMatch(appShell, /sourceTools=\[[^\]]*Second Brain Git/);
  assert.match(appShell, /navItems=\[[^\]]*Second Brain Git/);
  assert.match(appTemplate, /activeView === 'git'/);
  assert.match(appShell, /return\{[^}]*sourceTools,navItems,noteStatuses,currentView/);
  assert.match(appShellVue, /sourceTools,\s+navItems,\s+noteStatuses,/);
});

test("tiktok note panel renders create feedback", () => {
  const tiktokPanel = appTemplate.match(/<form v-if="selectedSourceTool === 'tiktok'"[\s\S]*?<\/form>/)?.[0] ?? "";
  assert.match(appShell, /Created \$\{payload\?\.path/);
  assert.match(tiktokPanel, /v-if="gitResult"/);
});

test("inbox view includes second brain inbox notes", () => {
  assert.match(appShell, /const inboxNotes=computed/);
  assert.match(appShell, /sourcePath\?\.split/);
  assert.match(appShell, /noteMetadata\(note\)\.status==="inbox"/);
  assert.match(appShell, /visibleInboxItems/);
  assert.match(appShell, /kind:"note"/);
  assert.match(appInbox, /@click="openInboxNote\(inboxItem\.note\)"/);
});

test("inbox cards use compact labeled icon button groups", () => {
  assert.doesNotMatch(appInbox, /Select an RSS item or e-mail to inspect it/);
  assert.match(appInbox, /class="join/);
  assert.match(appInbox, /aria-label="Open e-mail"/);
  assert.match(appInbox, /aria-label="Save RSS item"/);
  assert.doesNotMatch(appInbox, /<i class="fa-solid fa-eye"><\/i>\s+Open/);
});

test("inbox source note action uses AI link note endpoint", () => {
  assert.match(appTemplate, /:note-source="noteSource"/);
  assert.match(appInbox, /show-note/);
  assert.match(appInbox, /@note="noteSource\(inboxItem\.source\)"/);
  assert.match(appShell, /async function noteSource/);
  assert.match(appShell, /\/api\/links\/\$\{link\.id\}\/note/);
  assert.match(serverApp, /app\.post\("\/api\/links\/:id\/note"/);
  assert.match(serverApp, /createLinkNoteMarkdown/);
  assert.match(serverApp, /app\.post\("\/api\/rss\/items\/note"/);
  assert.match(serverApp, /enqueueJobResponse\(res,"ai"/);
});

test("inbox can import an article URL as a source", () => {
  assert.match(appInbox, /@submit\.prevent="importArticle"/);
  assert.match(appInbox, /v-model="sourceForm\.url"/);
  assert.match(appShellVue, /async function importArticle/);
  assert.match(appShellVue, /\/api\/links\/preview/);
  assert.match(appShellVue, /\/api\/links/);
  assert.match(appShellVue, /"status:inbox",\s*"article"/);
});

test("notes can be deleted from the detail view", () => {
  assert.match(appShell, /async function deleteNote\([^)]*\)/);
  assert.match(appShell, /enqueueJob\(`\/api\/notes\/\$\{note\.id\}`,\{\},[\s\S]*?,"DELETE"\)/);
  assert.match(appTemplate, /@click="deleteNote\(selectedNote\)"/);
  assert.match(appTemplate, /aria-label="Move note"/);
});

test("delete note endpoint queues second brain sync so imported files are removed", () => {
  assert.match(serverApp, /app\.delete\("\/api\/notes\/:id"/);
  assert.match(serverApp, /noteStore\.listNotes\(\)\.find/);
  assert.match(serverApp, /rmSync\(target,\{force:true\}\)/);
  assert.match(serverApp, /noteStore\.deleteNote\(id\)/);
  assert.match(serverApp, /syncSecondBrainNotes\(dbPath,secondBrainPath\)/);
  assert.match(serverApp, /enqueueJobResponse\(res,"workflow",`Delete note: \$\{note\.title\}`/);
});

test("review queue is surfaced on the dashboard", () => {
  assert.match(appDashboard, /Review Queue/);
  assert.match(appDashboard, /reviewQueue\.length/);
  assert.match(appDashboard, /emit\('setReviewStatus'/);
  assert.match(appTemplate, /:review-queue="reviewQueue"/);
  assert.match(appTemplate, /@set-review-status="setReviewStatus"/);
  assert.match(appShell, /const reviewQueue=ref\(\[\]\)/);
  assert.match(appShell, /async function loadReviewQueue\(\)/);
  assert.match(appShell, /async function setReviewStatus\(item,status\)/);
});

test("tiktok note is queued as a background job", () => {
  assert.match(appShell, /response\.json\(\)\.catch/);
  assert.match(appShell, /enqueueJob\("\/api\/second-brain\/tiktok-note"/);
  assert.match(appShell, /Queued: \$\{payload\.job\?\.title/);
});
