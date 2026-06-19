import assert from "node:assert/strict";
import test from "node:test";
import { createLinkStore } from "../server/linkStore";

test("link store persists links and tags in SQLite", () => {
  const store = createLinkStore(":memory:");

  const saved = store.addLink({
    title: "TypeScript",
    description: "The official TypeScript documentation.",
    url: "https://www.typescriptlang.org/docs/",
    tags: ["TypeScript", "Documentation"]
  });

  assert.equal(saved.id, 1);
  assert.deepEqual(store.listLinks(), [saved]);

  store.close();
});

test("link store updates and deletes links", () => {
  const store = createLinkStore(":memory:");
  const saved = store.addLink({
    title: "Old title",
    description: "Old description",
    url: "https://example.com/old",
    tags: ["old"]
  });

  const updated = store.updateLink(saved.id, {
    title: "New title",
    description: "New description",
    url: "https://example.com/new",
    tags: ["new", "sqlite"]
  });

  assert.deepEqual(updated, {
    id: saved.id,
    title: "New title",
    description: "New description",
    url: "https://example.com/new",
    tags: ["new", "sqlite"]
  });

  assert.equal(store.deleteLink(saved.id), true);
  assert.deepEqual(store.listLinks(), []);
  assert.equal(store.deleteLink(saved.id), false);

  store.close();
});
