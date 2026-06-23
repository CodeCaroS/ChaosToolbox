import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import Database from "better-sqlite3";
import { scanSecondBrainNotes } from "./secondBrainNotes";
import { ensureNoteFrontmatter } from "./noteMarkdown";

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
      metadata_json TEXT NOT NULL DEFAULT '{}',
      imported_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  ensureColumn(db, "second_brain_imports", "note_hash", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "second_brain_imports", "metadata_json", "TEXT NOT NULL DEFAULT '{}'");

  const sync = db.transaction(() => {
    const result: SecondBrainSyncResult = { created: 0, updated: 0, unchanged: 0, deleted: 0, written: 0, conflicts: 0 };
    const categoryId = ensureSecondBrainCategory(db);
    const now = new Date().toISOString();
    const files = scanSecondBrainNotes(root);
    const filePaths = new Set(files.map((file) => file.path));

    for (const file of files) {
      const existing = db.prepare("SELECT note_id AS noteId, content_hash AS contentHash, note_hash AS noteHash, metadata_json AS metadataJson FROM second_brain_imports WHERE path = ?").get(file.path) as
        | { noteId: number; contentHash: string; noteHash: string; metadataJson: string }
        | undefined;
      const noteHash = hashNote(file.title, file.body);
      const metadataJson = JSON.stringify(file.meta);

      if (!existing) {
        const inserted = db
          .prepare("INSERT INTO notes (title, body, category_id) VALUES (?, ?, ?)")
          .run(file.title, file.body, categoryId);
        db
          .prepare("INSERT INTO second_brain_imports (path, note_id, content_hash, note_hash, metadata_json, imported_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .run(file.path, Number(inserted.lastInsertRowid), file.contentHash, noteHash, metadataJson, now, now);
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
          db.prepare("UPDATE second_brain_imports SET note_hash = ?, metadata_json = ?, updated_at = ? WHERE path = ?").run(currentNoteHash, metadataJson, now, file.path);
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
            .prepare("UPDATE second_brain_imports SET content_hash = ?, note_hash = ?, metadata_json = ?, updated_at = ? WHERE path = ?")
            .run(file.contentHash, noteHash, metadataJson, now, file.path);
          result.updated += 1;
        } else if (noteChanged) {
          const markdown = formatMarkdown(note.title, note.body);
          const targetPath = refinedInboxTarget(file.path, note.body) ?? file.path;
          if (targetPath !== file.path && existsSync(join(root, targetPath))) {
            result.conflicts += 1;
            continue;
          }
          mkdirSync(dirname(join(root, targetPath)), { recursive: true });
          writeFileSync(join(root, targetPath), markdown);
          if (targetPath !== file.path) rmSync(join(root, file.path), { force: true });
          const writtenHash = hashBody(markdown);
          db
            .prepare("UPDATE second_brain_imports SET path = ?, content_hash = ?, note_hash = ?, metadata_json = ?, updated_at = ? WHERE path = ?")
            .run(targetPath, writtenHash, currentNoteHash, JSON.stringify(parseNoteMeta(note.body)), now, file.path);
          filePaths.add(targetPath);
          result.written += 1;
        } else if (existing.metadataJson !== metadataJson) {
          db.prepare("UPDATE second_brain_imports SET metadata_json = ?, updated_at = ? WHERE path = ?").run(metadataJson, now, file.path);
          result.unchanged += 1;
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
  return `${ensureNoteFrontmatter(title, body).trimEnd()}\n`;
}

const FOLDER_BY_KIND: Record<string, string> = {
  knowledge: "01-knowledge",
  "ai-capture": "01-knowledge",
  source: "02-sources",
  project: "03-projects",
  decision: "04-decisions",
  task: "05-tasks",
  review: "06-reviews",
  archive: "99-archive"
};

function refinedInboxTarget(path: string, body: string): string | null {
  if (!path.startsWith("00-inbox/")) return null;
  const meta = parseNoteMeta(body);
  if (meta.status !== "refined") return null;
  const folder = FOLDER_BY_KIND[meta.kind ?? ""];
  const topic = slug(meta.topic ?? "");
  return folder ? [folder, topic, ...path.split("/").slice(1)].filter(Boolean).join("/") : null;
}

function parseNoteMeta(body: string): { kind?: string; status?: string; topic?: string } {
  const match = body.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return {};
  const meta: { kind?: string; status?: string; topic?: string } = {};
  for (const line of match[1].split("\n")) {
    const pair = line.match(/^(kind|type|status|topic):\s*(.*)$/);
    if (!pair) continue;
    const key = pair[1] === "type" ? "kind" : pair[1];
    meta[key as "kind" | "status" | "topic"] = pair[2].replace(/^["']|["']$/g, "").trim();
  }
  return meta;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function hashNote(title: string, body: string): string {
  return createHash("sha256").update(`${title}\0${body}`).digest("hex");
}

function hashBody(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}
