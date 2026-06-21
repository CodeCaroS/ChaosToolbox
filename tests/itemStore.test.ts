import assert from "node:assert/strict";
import test from "node:test";
import { createItemStore } from "../server/itemStore";

test("item store creates, updates and deletes catalog items", () => {
  const store = createItemStore(":memory:");
  const saved = store.addItem({
    name: "Tigerius",
    type: "Pet",
    quality: "Rare",
    source: "Dungeon",
    description: "Small catalog entry.",
    url: "https://example.com/tigerius"
  });

  assert.deepEqual(store.listItems(), [saved]);
  assert.deepEqual(store.updateItem(saved.id, { ...saved, name: "Updated", url: "" }), {
    id: saved.id,
    name: "Updated",
    type: "Pet",
    quality: "Rare",
    source: "Dungeon",
    description: "Small catalog entry.",
    url: ""
  });
  assert.equal(store.deleteItem(saved.id), true);
  assert.deepEqual(store.listItems(), []);

  store.close();
});
