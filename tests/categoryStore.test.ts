import assert from "node:assert/strict";
import test from "node:test";
import { createCategoryStore } from "../server/categoryStore";

test("category store creates, renames and deletes categories", () => {
  const store = createCategoryStore(":memory:");
  const saved = store.addCategory("Framework");

  assert.deepEqual(store.listCategories(), [saved]);
  assert.deepEqual(store.updateCategory(saved.id, "Docs"), { id: saved.id, name: "Docs" });
  assert.equal(store.deleteCategory(saved.id), true);
  assert.deepEqual(store.listCategories(), []);

  store.close();
});
