import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import Database from "better-sqlite3";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createTaskStore } from "../server/taskStore";

test("task store mirrors tasks into the shared artifact core", () => {
  const filename = join(mkdtempSync(join(tmpdir(), "chaostoolbox-")), "tasks.sqlite");
  const tasks = createTaskStore(filename);
  const db = new Database(filename);

  const saved = tasks.addTask({ title: "Plan core", notes: "Make it shared.", priority: 0, dueDate: null, repeat: "", categoryId: null, tags: ["status:triaged"], steps: [] });
  const artifact = db.prepare("SELECT entity_type AS entityType, entity_id AS entityId, title, type, status FROM artifacts WHERE entity_type = ? AND entity_id = ?").get("task", saved.id) as { entityType: string; entityId: number; title: string; type: string; status: string };

  assert.deepEqual(artifact, {
    entityType: "task",
    entityId: saved.id,
    title: "Plan core",
    type: "task",
    status: "triaged"
  });

  tasks.updateTask(saved.id, { title: "Updated core", notes: "Still shared.", priority: 1, dueDate: null, repeat: "", categoryId: null, tags: ["status:reviewed"], steps: [] });
  const updated = db.prepare("SELECT title, status FROM artifacts WHERE entity_type = ? AND entity_id = ?").get("task", saved.id) as { title: string; status: string };
  assert.deepEqual(updated, { title: "Updated core", status: "reviewed" });

  tasks.deleteTask(saved.id);
  const missing = db.prepare("SELECT count(*) AS count FROM artifacts WHERE entity_type = ? AND entity_id = ?").get("task", saved.id) as { count: number };
  assert.equal(missing.count, 0);

  db.close();
  tasks.close();
});
