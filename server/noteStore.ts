import Database from "better-sqlite3";
import { deleteArtifactForEntity, ensureArtifactCore, upsertArtifact } from "./artifactCore";
import type { NewNoteEntry, NoteEntry, NoteMetadata } from "../src/modules/notes/types";

export function createNoteStore(filename: string) {
  const db = new Database(filename);
  ensureArtifactCore(db);
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
    CREATE TABLE IF NOT EXISTS second_brain_imports (
      path TEXT PRIMARY KEY,
      note_id INTEGER NOT NULL,
      content_hash TEXT NOT NULL,
      note_hash TEXT NOT NULL DEFAULT '',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      imported_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  ensureColumn(db, "second_brain_imports", "metadata_json", "TEXT NOT NULL DEFAULT '{}'");

  function getNote(id: number): NoteEntry {
    const row = db
      .prepare(`
        SELECT notes.id, notes.title, notes.body, notes.category_id AS categoryId, categories.name AS categoryName,
          second_brain_imports.path AS sourcePath,
          second_brain_imports.metadata_json AS metadataJson
        FROM notes
        LEFT JOIN categories ON categories.id = notes.category_id
        LEFT JOIN second_brain_imports ON second_brain_imports.note_id = notes.id
        WHERE notes.id = ?
      `)
      .get(id) as NoteRow;
    return rowToNote(row);
  }

  function listNotes(): NoteEntry[] {
    return (db
      .prepare(`
        SELECT notes.id, notes.title, notes.body, notes.category_id AS categoryId, categories.name AS categoryName,
          second_brain_imports.path AS sourcePath,
          second_brain_imports.metadata_json AS metadataJson
        FROM notes
        LEFT JOIN categories ON categories.id = notes.category_id
        LEFT JOIN second_brain_imports ON second_brain_imports.note_id = notes.id
        ORDER BY notes.id DESC
      `)
      .all() as NoteRow[]).map(rowToNote);
  }

  function addNote(note: NewNoteEntry): NoteEntry {
    const result = db
      .prepare("INSERT INTO notes (title, body, category_id) VALUES (?, ?, ?)")
      .run(note.title.trim(), note.body, note.categoryId);
    const saved = getNote(Number(result.lastInsertRowid));
    upsertArtifact(db, {
      entityId: saved.id,
      entityType: "note",
      type: "note",
      title: saved.title,
      status: note.meta?.status || "draft",
      summary: ""
    });
    return saved;
  }

  function updateNote(id: number, note: NewNoteEntry): NoteEntry | null {
    const result = db
      .prepare("UPDATE notes SET title = ?, body = ?, category_id = ? WHERE id = ?")
      .run(note.title.trim(), note.body, note.categoryId, id);
    if (result.changes === 0) return null;
    const updated = getNote(id);
    upsertArtifact(db, {
      entityId: updated.id,
      entityType: "note",
      type: "note",
      title: updated.title,
      status: note.meta?.status || "draft",
      summary: ""
    });
    return updated;
  }

  function deleteNote(id: number): boolean {
    const deleted = db.prepare("DELETE FROM notes WHERE id = ?").run(id).changes > 0;
    if (deleted) deleteArtifactForEntity(db, "note", id);
    return deleted;
  }

  return {
    addNote,
    close: () => db.close(),
    deleteNote,
    listNotes,
    updateNote
  };
}

type NoteRow = NoteEntry & { metadataJson?: string | null };

function rowToNote(row: NoteRow): NoteEntry {
  const { metadataJson, ...note } = row;
  const meta = parseMetadata(metadataJson);
  return meta ? { ...note, meta } : note;
}

function parseMetadata(value?: string | null): NoteMetadata | null {
  if (!value || value === "{}") return null;
  try {
    const parsed = JSON.parse(value) as NoteMetadata;
    const keys = parsed && typeof parsed === "object" ? Object.keys(parsed).filter((key) => key !== "title") : [];
    return keys.length ? parsed : null;
  } catch (_error) {
    return null;
  }
}

function ensureColumn(db: Database.Database, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((current) => current.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}
