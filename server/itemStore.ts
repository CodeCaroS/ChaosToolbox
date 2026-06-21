import Database from "better-sqlite3";
import type { ItemEntry, NewItemEntry } from "../src/modules/items/types";

export function createItemStore(filename: string) {
  const db = new Database(filename);
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT '',
      quality TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT ''
    );
  `);

  function getItem(id: number): ItemEntry {
    return db.prepare("SELECT id, name, type, quality, source, description, url FROM items WHERE id = ?").get(id) as ItemEntry;
  }

  function listItems(): ItemEntry[] {
    return db.prepare("SELECT id, name, type, quality, source, description, url FROM items ORDER BY id DESC").all() as ItemEntry[];
  }

  function addItem(item: NewItemEntry): ItemEntry {
    const result = db
      .prepare("INSERT INTO items (name, type, quality, source, description, url) VALUES (?, ?, ?, ?, ?, ?)")
      .run(item.name.trim(), item.type.trim(), item.quality.trim(), item.source.trim(), item.description.trim(), item.url.trim());
    return getItem(Number(result.lastInsertRowid));
  }

  function updateItem(id: number, item: NewItemEntry): ItemEntry | null {
    const result = db
      .prepare("UPDATE items SET name = ?, type = ?, quality = ?, source = ?, description = ?, url = ? WHERE id = ?")
      .run(item.name.trim(), item.type.trim(), item.quality.trim(), item.source.trim(), item.description.trim(), item.url.trim(), id);
    return result.changes === 0 ? null : getItem(id);
  }

  function deleteItem(id: number): boolean {
    return db.prepare("DELETE FROM items WHERE id = ?").run(id).changes > 0;
  }

  return {
    addItem,
    close: () => db.close(),
    deleteItem,
    listItems,
    updateItem
  };
}
