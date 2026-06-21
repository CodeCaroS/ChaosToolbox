import assert from "node:assert/strict";
import test from "node:test";
import { createLibraryStore } from "../server/libraryStore";

test("library store creates, updates and deletes works with tags", () => {
  const store = createLibraryStore(":memory:");
  const saved = store.addLibraryEntry({
    title: "My First Work",
    author: "Jane Doe",
    series: "Archive",
    status: "incomplete",
    url: "https://example.com/work",
    description: "Reading backlog",
    categoryId: null,
    tags: ["fic", "fic", "favorite"]
  });

  assert.equal(saved.title, "My First Work");
  assert.deepEqual(saved.tags, ["favorite", "fic"]);
  assert.deepEqual(store.updateLibraryEntry(saved.id, { ...saved, status: "complete", tags: ["done"] }), {
    ...saved,
    status: "complete",
    tags: ["done"]
  });
  assert.equal(store.deleteLibraryEntry(saved.id), true);
  assert.deepEqual(store.listLibrary(), []);
  store.close();
});
