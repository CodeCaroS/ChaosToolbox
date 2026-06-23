import Database from "better-sqlite3";
import { deleteArtifactForEntity, ensureArtifactCore, upsertArtifact } from "./artifactCore";
import type { LinkEntry, NewLinkEntry } from "../src/modules/linklist/types";

type SeedLink = Omit<LinkEntry, "tags"> & { tags: Array<string | { name: string }> };

export function createLinkStore(filename: string, seedLinks: SeedLink[] = []) {
  const db = new Database(filename);
  db.pragma("foreign_keys = ON");
  ensureArtifactCore(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL,
      category_id INTEGER
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE
    );
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE
    );
    CREATE TABLE IF NOT EXISTS link_tags (
      link_id INTEGER NOT NULL REFERENCES links(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (link_id, tag_id)
    );
  `);
  const columns = db.prepare("PRAGMA table_info(links)").all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "category_id")) {
    db.prepare("ALTER TABLE links ADD COLUMN category_id INTEGER").run();
  }

  const addLinkTx = db.transaction((link: NewLinkEntry) => {
    const result = db
      .prepare("INSERT INTO links (title, description, url, category_id) VALUES (?, ?, ?, ?)")
      .run(link.title.trim(), link.description.trim(), link.url.trim(), link.categoryId);
    const linkId = Number(result.lastInsertRowid);

    const insertTag = db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)");
    const findTag = db.prepare("SELECT id FROM tags WHERE name = ?");
    const connectTag = db.prepare("INSERT OR IGNORE INTO link_tags (link_id, tag_id) VALUES (?, ?)");

    for (const tag of cleanTags(link.tags)) {
      insertTag.run(tag);
      connectTag.run(linkId, (findTag.get(tag) as { id: number }).id);
    }

    const saved = getLink(linkId);
    upsertArtifact(db, {
      entityId: saved.id,
      entityType: "source",
      type: "source",
      title: saved.title,
      status: sourceStatus(saved.tags),
      summary: saved.description || ""
    });
    return saved;
  });

  const setTags = db.transaction((linkId: number, tags: string[]) => {
    db.prepare("DELETE FROM link_tags WHERE link_id = ?").run(linkId);
    const insertTag = db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)");
    const findTag = db.prepare("SELECT id FROM tags WHERE name = ?");
    const connectTag = db.prepare("INSERT OR IGNORE INTO link_tags (link_id, tag_id) VALUES (?, ?)");

    for (const tag of cleanTags(tags)) {
      insertTag.run(tag);
      connectTag.run(linkId, (findTag.get(tag) as { id: number }).id);
    }
  });

  const updateLinkTx = db.transaction((id: number, link: NewLinkEntry) => {
    const result = db
      .prepare("UPDATE links SET title = ?, description = ?, url = ?, category_id = ? WHERE id = ?")
      .run(link.title.trim(), link.description.trim(), link.url.trim(), link.categoryId, id);

    if (result.changes === 0) return null;
    setTags(id, link.tags);
    const updated = getLink(id);
    upsertArtifact(db, {
      entityId: updated.id,
      entityType: "source",
      type: "source",
      title: updated.title,
      status: sourceStatus(updated.tags),
      summary: updated.description || ""
    });
    return updated;
  });

  function cleanTags(tags: string[]) {
    return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
  }

  function getLink(id: number): LinkEntry {
    const row = db
      .prepare(`
        SELECT links.id, links.title, links.description, links.url, links.category_id AS categoryId, categories.name AS categoryName
        FROM links
        LEFT JOIN categories ON categories.id = links.category_id
        WHERE links.id = ?
      `)
      .get(id) as LinkEntry;
    return { ...row, tags: getTags(id) };
  }

  function getTags(linkId: number): string[] {
    return db
      .prepare("SELECT tags.name FROM tags JOIN link_tags ON tags.id = link_tags.tag_id WHERE link_tags.link_id = ? ORDER BY tags.name")
      .all(linkId)
      .map((row) => (row as { name: string }).name);
  }

  function listLinks(): LinkEntry[] {
    return db
      .prepare(`
        SELECT links.id, links.title, links.description, links.url, links.category_id AS categoryId, categories.name AS categoryName
        FROM links
        LEFT JOIN categories ON categories.id = links.category_id
        ORDER BY links.id
      `)
      .all()
      .map((row) => {
        const link = row as Omit<LinkEntry, "tags">;
        return { ...link, tags: getTags(link.id) };
      });
  }

  function addLink(link: NewLinkEntry): LinkEntry {
    return addLinkTx({ ...link, tags: cleanTags(link.tags) });
  }

  function updateLink(id: number, link: NewLinkEntry): LinkEntry | null {
    return updateLinkTx(id, { ...link, tags: cleanTags(link.tags) });
  }

  function deleteLink(id: number): boolean {
    const deleted = db.prepare("DELETE FROM links WHERE id = ?").run(id).changes > 0;
    if (deleted) deleteArtifactForEntity(db, "source", id);
    return deleted;
  }

  const count = db.prepare("SELECT COUNT(*) AS count FROM links").get() as { count: number };
  if (count.count === 0 && seedLinks.length > 0) {
    for (const link of seedLinks) {
      addLink({
        title: link.title,
        description: link.description,
        url: link.url,
        categoryId: null,
        tags: link.tags.map((tag) => (typeof tag === "string" ? tag : tag.name))
      });
    }
  }

  return {
    addLink,
    deleteLink,
    listLinks,
    updateLink,
    close: () => db.close()
  };
}

function sourceStatus(tags: string[]) {
  const tag = tags.find((current) => current.startsWith("status:"));
  const status = tag?.replace("status:", "");
  return status === "keep" || status === "refine" || status === "archived" ? status : "inbox";
}
