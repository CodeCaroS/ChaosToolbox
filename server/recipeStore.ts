import Database from "better-sqlite3";
import type { NewRecipeEntry, RecipeEntry } from "../src/modules/recipes/types";

export function createRecipeStore(filename: string) {
  const db = new Database(filename);
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE
    );
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE
    );
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      rating INTEGER NOT NULL DEFAULT 0,
      category_id INTEGER,
      notes TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS recipe_tags (
      recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (recipe_id, tag_id)
    );
  `);

  function cleanTags(tags: string[]) {
    return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
  }

  function getTags(recipeId: number): string[] {
    return db
      .prepare("SELECT tags.name FROM tags JOIN recipe_tags ON tags.id = recipe_tags.tag_id WHERE recipe_tags.recipe_id = ? ORDER BY tags.name")
      .all(recipeId)
      .map((row) => (row as { name: string }).name);
  }

  function setTags(recipeId: number, tags: string[]) {
    db.prepare("DELETE FROM recipe_tags WHERE recipe_id = ?").run(recipeId);
    const insertTag = db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)");
    const findTag = db.prepare("SELECT id FROM tags WHERE name = ?");
    const connectTag = db.prepare("INSERT OR IGNORE INTO recipe_tags (recipe_id, tag_id) VALUES (?, ?)");

    for (const tag of cleanTags(tags)) {
      insertTag.run(tag);
      connectTag.run(recipeId, (findTag.get(tag) as { id: number }).id);
    }
  }

  function getRecipe(id: number): RecipeEntry {
    const row = db
      .prepare(`
        SELECT recipes.id, recipes.name, recipes.rating, recipes.category_id AS categoryId, categories.name AS categoryName, recipes.notes
        FROM recipes
        LEFT JOIN categories ON categories.id = recipes.category_id
        WHERE recipes.id = ?
      `)
      .get(id) as Omit<RecipeEntry, "tags">;
    return { ...row, tags: getTags(id) };
  }

  function listRecipes(): RecipeEntry[] {
    return db
      .prepare(`
        SELECT recipes.id, recipes.name, recipes.rating, recipes.category_id AS categoryId, categories.name AS categoryName, recipes.notes
        FROM recipes
        LEFT JOIN categories ON categories.id = recipes.category_id
        ORDER BY recipes.id DESC
      `)
      .all()
      .map((row) => {
        const recipe = row as Omit<RecipeEntry, "tags">;
        return { ...recipe, tags: getTags(recipe.id) };
      });
  }

  const addRecipeTx = db.transaction((recipe: NewRecipeEntry) => {
    const result = db
      .prepare("INSERT INTO recipes (name, rating, category_id, notes) VALUES (?, ?, ?, ?)")
      .run(recipe.name.trim(), recipe.rating, recipe.categoryId, recipe.notes.trim());
    const recipeId = Number(result.lastInsertRowid);
    setTags(recipeId, recipe.tags);
    return getRecipe(recipeId);
  });

  const updateRecipeTx = db.transaction((id: number, recipe: NewRecipeEntry) => {
    const result = db
      .prepare("UPDATE recipes SET name = ?, rating = ?, category_id = ?, notes = ? WHERE id = ?")
      .run(recipe.name.trim(), recipe.rating, recipe.categoryId, recipe.notes.trim(), id);

    if (result.changes === 0) return null;
    setTags(id, recipe.tags);
    return getRecipe(id);
  });

  function addRecipe(recipe: NewRecipeEntry): RecipeEntry {
    return addRecipeTx({ ...recipe, tags: cleanTags(recipe.tags) });
  }

  function updateRecipe(id: number, recipe: NewRecipeEntry): RecipeEntry | null {
    return updateRecipeTx(id, { ...recipe, tags: cleanTags(recipe.tags) });
  }

  function deleteRecipe(id: number): boolean {
    return db.prepare("DELETE FROM recipes WHERE id = ?").run(id).changes > 0;
  }

  return {
    addRecipe,
    close: () => db.close(),
    deleteRecipe,
    listRecipes,
    updateRecipe
  };
}
