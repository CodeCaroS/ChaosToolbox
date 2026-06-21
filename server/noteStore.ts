import Database from "better-sqlite3";
import type { NewNoteEntry, NoteEntry } from "../src/modules/notes/types";

export function createNoteStore(filename: string) {
  const db = new Database(filename);
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE
    );
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      category_id INTEGER
    );
  `);

  function getNote(id: number): NoteEntry {
    return db
      .prepare(`
        SELECT notes.id, notes.title, notes.body, notes.category_id AS categoryId, categories.name AS categoryName
        FROM notes
        LEFT JOIN categories ON categories.id = notes.category_id
        WHERE notes.id = ?
      `)
      .get(id) as NoteEntry;
  }

  function listNotes(): NoteEntry[] {
    return db
      .prepare(`
        SELECT notes.id, notes.title, notes.body, notes.category_id AS categoryId, categories.name AS categoryName
        FROM notes
        LEFT JOIN categories ON categories.id = notes.category_id
        ORDER BY notes.id DESC
      `)
      .all() as NoteEntry[];
  }

  function addNote(note: NewNoteEntry): NoteEntry {
    const result = db
      .prepare("INSERT INTO notes (title, body, category_id) VALUES (?, ?, ?)")
      .run(note.title.trim(), note.body.trim(), note.categoryId);
    return getNote(Number(result.lastInsertRowid));
  }

  function updateNote(id: number, note: NewNoteEntry): NoteEntry | null {
    const result = db
      .prepare("UPDATE notes SET title = ?, body = ?, category_id = ? WHERE id = ?")
      .run(note.title.trim(), note.body.trim(), note.categoryId, id);
    return result.changes === 0 ? null : getNote(id);
  }

  function deleteNote(id: number): boolean {
    return db.prepare("DELETE FROM notes WHERE id = ?").run(id).changes > 0;
  }

  return {
    addNote,
    close: () => db.close(),
    deleteNote,
    listNotes,
    updateNote
  };
}
