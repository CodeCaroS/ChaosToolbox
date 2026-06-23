import assert from "node:assert/strict";
import test from "node:test";

import { registerDecisionRoutes } from "../server/decisionRoutes";

function createMockApp() {
  const routes: Array<{ method: string; path: string }> = [];
  return {
    routes,
    get(path: string) {
      routes.push({ method: "get", path });
    }
  };
}

test("registerDecisionRoutes exposes a decisions list endpoint", () => {
  const app = createMockApp();
  registerDecisionRoutes(app as never, { listNotes: () => [] } as never);

  assert.deepEqual(app.routes, [{ method: "get", path: "/api/decisions" }]);
});
