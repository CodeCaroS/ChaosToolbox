import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import { createCategoryStore } from "../server/categoryStore";
import { createNoteStore } from "../server/noteStore";

test("note store creates, updates and deletes categorized notes", () => {
  const filename = join(mkdtempSync(join(tmpdir(), "chaostoolbox-")), "notes.sqlite");
  const categories = createCategoryStore(filename);
  const notes = createNoteStore(filename);
  const category = categories.addCategory("Guide");

  const saved = notes.addNote({ title: "Build notes", body: "Keep it small.", categoryId: category.id });

  assert.deepEqual(notes.listNotes(), [{ ...saved, categoryName: "Guide", sourcePath: null }]);
  assert.deepEqual(notes.updateNote(saved.id, { title: "Updated", body: "Still small.", categoryId: null }), {
    id: saved.id,
    title: "Updated",
    body: "Still small.",
    categoryId: null,
    categoryName: null,
    sourcePath: null
  });
  assert.equal(notes.deleteNote(saved.id), true);
  assert.deepEqual(notes.listNotes(), []);

  notes.close();
  categories.close();
});

test("note store includes second brain source paths", () => {
  const filename = join(mkdtempSync(join(tmpdir(), "chaostoolbox-")), "notes.sqlite");
  const notes = createNoteStore(filename);
  const saved = notes.addNote({ title: "Agent loops", body: "Loop notes.", categoryId: null });
  const db = new Database(filename);

  db.prepare("INSERT INTO second_brain_imports (path, note_id, content_hash, imported_at, updated_at) VALUES (?, ?, '', '', '')")
    .run("01-knowledge/concepts/agent-loops.md", saved.id);

  assert.equal(notes.listNotes()[0].sourcePath, "01-knowledge/concepts/agent-loops.md");

  db.close();
  notes.close();
});
