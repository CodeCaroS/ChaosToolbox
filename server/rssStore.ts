import Database from "better-sqlite3";
import type { FeedEntry, FeedItemEntry, NewFeedEntry, ParsedFeedItem } from "../src/modules/rss/types";

type FeedItemStatus = FeedItemEntry["status"];

export function createRssStore(filename: string) {
  const db = new Database(filename);
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS feeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      enabled INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS feed_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feed_id INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      published_at TEXT,
      summary TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'new',
      UNIQUE(feed_id, url)
    );
  `);
  const itemColumns = db.prepare("PRAGMA table_info(feed_items)").all() as Array<{ name: string }>;
  if (!itemColumns.some((column) => column.name === "summary")) {
    db.prepare("ALTER TABLE feed_items ADD COLUMN summary TEXT NOT NULL DEFAULT ''").run();
  }

  function rowToFeed(row: unknown): FeedEntry {
    const feed = row as Omit<FeedEntry, "enabled"> & { enabled: number };
    return { ...feed, enabled: feed.enabled === 1 };
  }

  function rowToItem(row: unknown): FeedItemEntry {
    const item = row as Omit<FeedItemEntry, "publishedAt"> & { publishedAt: string | null };
    return item;
  }

  function getFeed(id: number): FeedEntry {
    return rowToFeed(db.prepare("SELECT id, title, url, enabled FROM feeds WHERE id = ?").get(id));
  }

  function addFeed(feed: NewFeedEntry): FeedEntry {
    const result = db
      .prepare("INSERT INTO feeds (title, url, enabled) VALUES (?, ?, ?)")
      .run(feed.title.trim(), feed.url.trim(), feed.enabled === false ? 0 : 1);
    return getFeed(Number(result.lastInsertRowid));
  }

  function listFeeds(): FeedEntry[] {
    return db.prepare("SELECT id, title, url, enabled FROM feeds ORDER BY id DESC").all().map(rowToFeed);
  }

  const upsertFeedItemsTx = db.transaction((feedId: number, items: ParsedFeedItem[]) => {
    const result = { created: 0, unchanged: 0 };
    const exists = db.prepare("SELECT id FROM feed_items WHERE feed_id = ? AND url = ?");
    const insert = db.prepare("INSERT INTO feed_items (feed_id, title, url, published_at, summary) VALUES (?, ?, ?, ?, ?)");
    for (const item of items) {
      if (exists.get(feedId, item.url)) {
        result.unchanged += 1;
      } else {
        insert.run(feedId, item.title.trim(), item.url.trim(), item.publishedAt, item.summary.trim());
        result.created += 1;
      }
    }
    return result;
  });

  function upsertFeedItems(feedId: number, items: ParsedFeedItem[]) {
    return upsertFeedItemsTx(feedId, items);
  }

  function listFeedItems(status?: FeedItemStatus): FeedItemEntry[] {
    const query = `
      SELECT feed_items.id, feed_items.feed_id AS feedId, feeds.title AS feedTitle, feed_items.title, feed_items.url,
        feed_items.published_at AS publishedAt, feed_items.summary, feed_items.status
      FROM feed_items
      JOIN feeds ON feeds.id = feed_items.feed_id
      ${status ? "WHERE feed_items.status = ?" : ""}
      ORDER BY feed_items.id DESC
    `;
    return (status ? db.prepare(query).all(status) : db.prepare(query).all()).map(rowToItem);
  }

  function markFeedItem(feedId: number, url: string, status: FeedItemStatus): boolean {
    return db.prepare("UPDATE feed_items SET status = ? WHERE feed_id = ? AND url = ?").run(status, feedId, url).changes > 0;
  }

  function setFeedEnabled(id: number, enabled: boolean): boolean {
    return db.prepare("UPDATE feeds SET enabled = ? WHERE id = ?").run(enabled ? 1 : 0, id).changes > 0;
  }

  function deleteFeed(id: number): boolean {
    return db.prepare("DELETE FROM feeds WHERE id = ?").run(id).changes > 0;
  }

  return {
    addFeed,
    close: () => db.close(),
    deleteFeed,
    listFeedItems,
    listFeeds,
    markFeedItem,
    setFeedEnabled,
    upsertFeedItems
  };
}
