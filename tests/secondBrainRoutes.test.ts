import assert from "node:assert/strict";
import test from "node:test";

import { registerSecondBrainRoutes } from "../server/secondBrainRoutes";

function createMockApp() {
  const routes: Array<{ method: string; path: string }> = [];
  return {
    routes,
    get(path: string) {
      routes.push({ method: "get", path });
    },
    post(path: string) {
      routes.push({ method: "post", path });
    }
  };
}

test("registerSecondBrainRoutes exposes sync, tiktok and git endpoints", () => {
  const app = createMockApp();
  registerSecondBrainRoutes(app as never, {
    dbPath: "db",
    secondBrainPath: "repo",
    jobs: {
      enqueue: () => ({ id: 1 })
    },
    noteStore: {
      addNote: () => ({})
    },
    syncSecondBrainNotes: () => ({ created: 0, updated: 0, unchanged: 0, deleted: 0, written: 0, conflicts: 0 }),
    createTikTokKnowledgeNote: async () => ({ path: "note.md" }),
    getSecondBrainGitStatus: () => ({})
  } as never);

  assert.deepEqual(app.routes, [
    { method: "post", path: "/api/second-brain/import" },
    { method: "post", path: "/api/second-brain/tiktok-note" },
    { method: "get", path: "/api/second-brain/git/status" },
    { method: "post", path: "/api/second-brain/git/commit" },
    { method: "post", path: "/api/second-brain/git/push" },
    { method: "post", path: "/api/second-brain/git/force-push" },
    { method: "post", path: "/api/second-brain/git/pull" }
  ]);
});
