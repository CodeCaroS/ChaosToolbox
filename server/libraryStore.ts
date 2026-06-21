import Database from "better-sqlite3";
import type { LibraryEntry, NewLibraryEntry } from "../src/modules/library/types";

export function createLibraryStore(filename: string) {
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
    CREATE TABLE IF NOT EXISTS library (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT '',
      series TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'incomplete',
      url TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      category_id INTEGER
    );
    CREATE TABLE IF NOT EXISTS library_tags (
      library_id INTEGER NOT NULL REFERENCES library(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (library_id, tag_id)
    );
  `);

  function cleanTags(tags: string[]) {
    return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
  }

  function getTags(libraryId: number): string[] {
    return db
      .prepare("SELECT tags.name FROM tags JOIN library_tags ON tags.id = library_tags.tag_id WHERE library_tags.library_id = ? ORDER BY tags.name")
      .all(libraryId)
      .map((row) => (row as { name: string }).name);
  }

  function setTags(libraryId: number, tags: string[]) {
    db.prepare("DELETE FROM library_tags WHERE library_id = ?").run(libraryId);
    const insertTag = db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)");
    const findTag = db.prepare("SELECT id FROM tags WHERE name = ?");
    const connectTag = db.prepare("INSERT OR IGNORE INTO library_tags (library_id, tag_id) VALUES (?, ?)");

    for (const tag of cleanTags(tags)) {
      insertTag.run(tag);
      connectTag.run(libraryId, (findTag.get(tag) as { id: number }).id);
    }
  }

  function getLibraryEntry(id: number): LibraryEntry {
    const row = db
      .prepare(`
        SELECT library.id, library.title, library.author, library.series, library.status, library.url, library.description, library.category_id AS categoryId, categories.name AS categoryName
        FROM library
        LEFT JOIN categories ON categories.id = library.category_id
        WHERE library.id = ?
      `)
      .get(id) as Omit<LibraryEntry, "tags">;
    return { ...row, tags: getTags(id) };
  }

  function listLibrary(): LibraryEntry[] {
    return db
      .prepare(`
        SELECT library.id, library.title, library.author, library.series, library.status, library.url, library.description, library.category_id AS categoryId, categories.name AS categoryName
        FROM library
        LEFT JOIN categories ON categories.id = library.category_id
        ORDER BY library.id DESC
      `)
      .all()
      .map((row) => {
        const entry = row as Omit<LibraryEntry, "tags">;
        return { ...entry, tags: getTags(entry.id) };
      });
  }

  const addLibraryEntryTx = db.transaction((entry: NewLibraryEntry) => {
    const result = db
      .prepare("INSERT INTO library (title, author, series, status, url, description, category_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(entry.title.trim(), entry.author.trim(), entry.series.trim(), entry.status, entry.url.trim(), entry.description.trim(), entry.categoryId);
    const entryId = Number(result.lastInsertRowid);
    setTags(entryId, entry.tags);
    return getLibraryEntry(entryId);
  });

  const updateLibraryEntryTx = db.transaction((id: number, entry: NewLibraryEntry) => {
    const result = db
      .prepare("UPDATE library SET title = ?, author = ?, series = ?, status = ?, url = ?, description = ?, category_id = ? WHERE id = ?")
      .run(entry.title.trim(), entry.author.trim(), entry.series.trim(), entry.status, entry.url.trim(), entry.description.trim(), entry.categoryId, id);
    if (result.changes === 0) return null;
    setTags(id, entry.tags);
    return getLibraryEntry(id);
  });

  function addLibraryEntry(entry: NewLibraryEntry): LibraryEntry {
    return addLibraryEntryTx({ ...entry, tags: cleanTags(entry.tags) });
  }

  function updateLibraryEntry(id: number, entry: NewLibraryEntry): LibraryEntry | null {
    return updateLibraryEntryTx(id, { ...entry, tags: cleanTags(entry.tags) });
  }

  function deleteLibraryEntry(id: number): boolean {
    return db.prepare("DELETE FROM library WHERE id = ?").run(id).changes > 0;
  }

  return {
    addLibraryEntry,
    close: () => db.close(),
    deleteLibraryEntry,
    listLibrary,
    updateLibraryEntry
  };
}
