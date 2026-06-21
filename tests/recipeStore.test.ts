import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createCategoryStore } from "../server/categoryStore";
import { createRecipeStore } from "../server/recipeStore";

test("recipe store creates, updates and deletes categorized recipes with tags", () => {
  const dir = mkdtempSync(join(tmpdir(), "chaostoolbox-recipes-"));
  const dbPath = join(dir, "test.sqlite");
  const categoryStore = createCategoryStore(dbPath);
  const category = categoryStore.addCategory("Dinner");
  categoryStore.close();

  const store = createRecipeStore(dbPath);
  const saved = store.addRecipe({
    name: "Pasta",
    rating: 4,
    categoryId: category.id,
    notes: "Fast weekday meal",
    tags: ["quick", "quick", "vegetarian"]
  });

  assert.equal(saved.name, "Pasta");
  assert.equal(saved.rating, 4);
  assert.equal(saved.categoryName, "Dinner");
  assert.deepEqual(saved.tags, ["quick", "vegetarian"]);

  const updated = store.updateRecipe(saved.id, {
    name: "Pasta Bowl",
    rating: 5,
    categoryId: null,
    notes: "Use pantry items",
    tags: ["pantry"]
  });

  assert.deepEqual(updated, {
    id: saved.id,
    name: "Pasta Bowl",
    rating: 5,
    categoryId: null,
    categoryName: null,
    notes: "Use pantry items",
    tags: ["pantry"]
  });

  assert.equal(store.deleteRecipe(saved.id), true);
  assert.deepEqual(store.listRecipes(), []);
  store.close();
  rmSync(dir, { recursive: true, force: true });
});
