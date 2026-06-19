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
