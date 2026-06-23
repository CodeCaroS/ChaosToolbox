import assert from "node:assert/strict";
import test from "node:test";

import { registerReviewRoutes } from "../server/reviewRoutes";

function createMockApp() {
  const routes: Array<{ method: string; path: string }> = [];
  return {
    routes,
    get(path: string) {
      routes.push({ method: "get", path });
    },
    patch(path: string) {
      routes.push({ method: "patch", path });
    }
  };
}

test("registerReviewRoutes exposes a review queue and status actions", () => {
  const app = createMockApp();
  registerReviewRoutes(app as never, {
    listReviewQueue: () => [],
    updateReviewStatus: () => null
  } as never);

  assert.deepEqual(app.routes, [
    { method: "get", path: "/api/review/queue" },
    { method: "patch", path: "/api/review/items/:entityType/:entityId" }
  ]);
});
