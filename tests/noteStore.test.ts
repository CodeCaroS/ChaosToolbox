import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createCategoryStore } from "../server/categoryStore";
import { createNoteStore } from "../server/noteStore";

test("note store creates, updates and deletes categorized notes", () => {
  const filename = join(mkdtempSync(join(tmpdir(), "chaostoolbox-")), "notes.sqlite");
  const categories = createCategoryStore(filename);
  const notes = createNoteStore(filename);
  const category = categories.addCategory("Guide");

  const saved = notes.addNote({ title: "Build notes", body: "Keep it small.", categoryId: category.id });

  assert.deepEqual(notes.listNotes(), [{ ...saved, categoryName: "Guide" }]);
  assert.deepEqual(notes.updateNote(saved.id, { title: "Updated", body: "Still small.", categoryId: null }), {
    id: saved.id,
    title: "Updated",
    body: "Still small.",
    categoryId: null,
    categoryName: null
  });
  assert.equal(notes.deleteNote(saved.id), true);
  assert.deepEqual(notes.listNotes(), []);

  notes.close();
  categories.close();
});
