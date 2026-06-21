import { createHash } from "node:crypto";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { scanSecondBrainNotes } from "./secondBrainNotes";

export type SecondBrainSyncResult = {
  created: number;
  updated: number;
  unchanged: number;
  deleted: number;
  written: number;
  conflicts: number;
};

export function syncSecondBrainNotes(filename: string, root: string): SecondBrainSyncResult {
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
    CREATE TABLE IF NOT EXISTS second_brain_imports (
      path TEXT PRIMARY KEY,
      note_id INTEGER NOT NULL,
      content_hash TEXT NOT NULL,
      note_hash TEXT NOT NULL DEFAULT '',
      imported_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  ensureColumn(db, "second_brain_imports", "note_hash", "TEXT NOT NULL DEFAULT ''");

  const sync = db.transaction(() => {
    const result: SecondBrainSyncResult = { created: 0, updated: 0, unchanged: 0, deleted: 0, written: 0, conflicts: 0 };
    const categoryId = ensureSecondBrainCategory(db);
    const now = new Date().toISOString();
    const files = scanSecondBrainNotes(root);
    const filePaths = new Set(files.map((file) => file.path));

    for (const file of files) {
      const existing = db.prepare("SELECT note_id AS noteId, content_hash AS contentHash, note_hash AS noteHash FROM second_brain_imports WHERE path = ?").get(file.path) as
        | { noteId: number; contentHash: string; noteHash: string }
        | undefined;
      const noteHash = hashNote(file.title, file.body);

      if (!existing) {
        const inserted = db
          .prepare("INSERT INTO notes (title, body, category_id) VALUES (?, ?, ?)")
          .run(file.title, file.body, categoryId);
        db
          .prepare("INSERT INTO second_brain_imports (path, note_id, content_hash, note_hash, imported_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
          .run(file.path, Number(inserted.lastInsertRowid), file.contentHash, noteHash, now, now);
        result.created += 1;
      } else {
        const note = getNote(db, existing.noteId);
        if (!note) {
          rmSync(join(root, file.path), { force: true });
          db.prepare("DELETE FROM second_brain_imports WHERE path = ?").run(file.path);
          result.deleted += 1;
          continue;
        }

        const currentNoteHash = hashNote(note.title, note.body);
        const fileChanged = existing.contentHash !== file.contentHash;
        const noteChanged = existing.noteHash !== "" && existing.noteHash !== currentNoteHash;

        if (existing.noteHash === "" && !fileChanged) {
          db.prepare("UPDATE second_brain_imports SET note_hash = ?, updated_at = ? WHERE path = ?").run(currentNoteHash, now, file.path);
          result.unchanged += 1;
          continue;
        }

        if (fileChanged && noteChanged) {
          result.conflicts += 1;
        } else if (fileChanged) {
          db
            .prepare("UPDATE notes SET title = ?, body = ?, category_id = ? WHERE id = ?")
            .run(file.title, file.body, categoryId, existing.noteId);
          db
            .prepare("UPDATE second_brain_imports SET content_hash = ?, note_hash = ?, updated_at = ? WHERE path = ?")
            .run(file.contentHash, noteHash, now, file.path);
          result.updated += 1;
        } else if (noteChanged) {
          const markdown = formatMarkdown(note.title, note.body);
          writeFileSync(join(root, file.path), markdown);
          const writtenHash = hashBody(markdown);
          db
            .prepare("UPDATE second_brain_imports SET content_hash = ?, note_hash = ?, updated_at = ? WHERE path = ?")
            .run(writtenHash, currentNoteHash, now, file.path);
          result.written += 1;
        } else {
          result.unchanged += 1;
        }
      }
    }

    const imports = db.prepare("SELECT path, note_id AS noteId FROM second_brain_imports").all() as Array<{ path: string; noteId: number }>;
    for (const imported of imports) {
      if (filePaths.has(imported.path)) continue;
      db.prepare("DELETE FROM notes WHERE id = ?").run(imported.noteId);
      db.prepare("DELETE FROM second_brain_imports WHERE path = ?").run(imported.path);
      rmSync(join(root, imported.path), { force: true });
      result.deleted += 1;
    }

    return result;
  });

  try {
    return sync();
  } finally {
    db.close();
  }
}

function ensureSecondBrainCategory(db: Database.Database): number {
  db.prepare("INSERT OR IGNORE INTO categories (name) VALUES ('second-brain')").run();
  return (db.prepare("SELECT id FROM categories WHERE name = 'second-brain'").get() as { id: number }).id;
}

function ensureColumn(db: Database.Database, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((current) => current.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

function getNote(db: Database.Database, id: number): { title: string; body: string } | null {
  return db.prepare("SELECT title, body FROM notes WHERE id = ?").get(id) as { title: string; body: string } | undefined ?? null;
}

function formatMarkdown(title: string, body: string): string {
  const trimmed = body.trimStart();
  if (trimmed.startsWith("#") || trimmed.startsWith("---\n")) return body;
  return `# ${title}\n\n${body}`;
}

function hashNote(title: string, body: string): string {
  return createHash("sha256").update(`${title}\0${body}`).digest("hex");
}

function hashBody(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}
