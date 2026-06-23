import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const serverIndex = readFileSync("server/index.ts", "utf8");
const serverApp = readFileSync("server/app.ts", "utf8");
const jobRoutes = readFileSync("server/jobRoutes.ts", "utf8");
const secondBrainRoutes = readFileSync("server/secondBrainRoutes.ts", "utf8");
const appShell = readFileSync("src/components/useAppShell.ts", "utf8");
const appShellVue = readFileSync("src/components/AppShell.vue", "utf8");
const appTemplate = readFileSync("src/components/AppShell.template.html", "utf8");

test("server exposes job status endpoints", () => {
  assert.match(serverApp, /createJobQueue/);
  assert.match(serverApp, /registerJobRoutes\(app,jobs\)/);
  assert.match(jobRoutes, /app\.get\("\/api\/jobs"/);
  assert.match(jobRoutes, /app\.get\("\/api\/jobs\/:id"/);
});

test("long workflow endpoints enqueue background jobs", () => {
  assert.match(serverApp, /registerSecondBrainRoutes\(app,\{dbPath,secondBrainPath,jobs,noteStore,syncSecondBrainNotes,createTikTokKnowledgeNote,getSecondBrainGitStatus,secondBrainGitEndpoints\}\)/);
  assert.match(serverApp, /registerProjectRoutes\(app,\{listNotes:\(\)=>noteStore\.listNotes\(\)\}\)/);
  assert.match(serverApp, /registerDecisionRoutes\(app,\{listNotes:\(\)=>noteStore\.listNotes\(\)\}\)/);
  for (const route of [
    "/api/rss/refresh",
    "/api/rss/feeds/:id/fetch",
    "/api/rss/items/note",
    "/api/links/:id/note",
    "/api/notes/metadata/suggest"
  ]) {
    assert.match(serverApp, new RegExp(`app\\.post\\("${route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[\\s\\S]*?enqueueJobResponse`));
  }
  assert.match(secondBrainRoutes, /app\.post\("\/api\/second-brain\/tiktok-note"/);
  assert.match(secondBrainRoutes, /app\.post\("\/api\/second-brain\/import"/);
  assert.match(secondBrainRoutes, /app\.post\("\/api\/second-brain\/git\/commit"/);
  assert.match(secondBrainRoutes, /app\.post\("\/api\/second-brain\/git\/pull"/);
  assert.match(secondBrainRoutes, /app\.post\("\/api\/second-brain\/git\/push"/);
});

test("app polls jobs and refreshes data after completion", () => {
  assert.match(appShell, /jobs=ref\(\[\]\)/);
  assert.match(appShell, /async function enqueueJob/);
  assert.match(appShell, /setInterval\(loadJobs/);
  assert.match(appShell, /async function loadJobs\(\)\{try\{jobs\.value=await getJson\("\/api\/jobs"\)/);
  assert.match(appTemplate, /fa-bell/);
  assert.match(appTemplate, /aria-label="Background jobs"/);
  assert.match(appShellVue, /gitStatus,\s+jobs,\s+activeView,/);
});
