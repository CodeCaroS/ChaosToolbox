import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import Database from "better-sqlite3";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createNoteStore } from "../server/noteStore";

test("note store mirrors notes into the shared artifact core", () => {
  const filename = join(mkdtempSync(join(tmpdir(), "chaostoolbox-")), "notes.sqlite");
  const notes = createNoteStore(filename);
  const db = new Database(filename);

  const saved = notes.addNote({ title: "Shared core", body: "Use one model.", categoryId: null });
  const artifact = db.prepare("SELECT entity_type AS entityType, entity_id AS entityId, title, type, status FROM artifacts WHERE entity_type = ? AND entity_id = ?").get("note", saved.id) as { entityType: string; entityId: number; title: string; type: string; status: string };

  assert.deepEqual(artifact, {
    entityType: "note",
    entityId: saved.id,
    title: "Shared core",
    type: "note",
    status: "draft"
  });

  notes.updateNote(saved.id, { title: "Updated shared core", body: "Still one model.", categoryId: null });
  const updated = db.prepare("SELECT title FROM artifacts WHERE entity_type = ? AND entity_id = ?").get("note", saved.id) as { title: string };
  assert.equal(updated.title, "Updated shared core");

  notes.deleteNote(saved.id);
  const missing = db.prepare("SELECT count(*) AS count FROM artifacts WHERE entity_type = ? AND entity_id = ?").get("note", saved.id) as { count: number };
  assert.equal(missing.count, 0);

  db.close();
  notes.close();
});
