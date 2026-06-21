import Database from "better-sqlite3";
import type { CategoryEntry } from "../src/modules/categories/types";

export function createCategoryStore(filename: string) {
  const db = new Database(filename);
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE
    );
  `);

  function getCategory(id: number): CategoryEntry {
    return db.prepare("SELECT id, name FROM categories WHERE id = ?").get(id) as CategoryEntry;
  }

  function listCategories(): CategoryEntry[] {
    return db.prepare("SELECT id, name FROM categories ORDER BY name").all() as CategoryEntry[];
  }

  function addCategory(name: string): CategoryEntry {
    const result = db.prepare("INSERT INTO categories (name) VALUES (?)").run(name.trim());
    return getCategory(Number(result.lastInsertRowid));
  }

  function updateCategory(id: number, name: string): CategoryEntry | null {
    const result = db.prepare("UPDATE categories SET name = ? WHERE id = ?").run(name.trim(), id);
    return result.changes === 0 ? null : getCategory(id);
  }

  function deleteCategory(id: number): boolean {
    return db.prepare("DELETE FROM categories WHERE id = ?").run(id).changes > 0;
  }

  return {
    addCategory,
    close: () => db.close(),
    deleteCategory,
    listCategories,
    updateCategory
  };
}
