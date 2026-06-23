import assert from "node:assert/strict";
import test from "node:test";

import { registerJobRoutes } from "../server/jobRoutes";

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

test("registerJobRoutes exposes job list and detail endpoints", () => {
  const app = createMockApp();
  registerJobRoutes(app as never, {
    listJobs: () => [],
    getJob: () => null,
    retry: () => null
  });

  assert.deepEqual(app.routes, [
    { method: "get", path: "/api/jobs" },
    { method: "get", path: "/api/jobs/:id" },
    { method: "post", path: "/api/jobs/:id/retry" }
  ]);
});
