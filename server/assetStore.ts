import Database from "better-sqlite3";
import type { AssetEntry, NewAssetEntry } from "../src/modules/assets/types";

export function createAssetStore(filename: string) {
  const db = new Database(filename);
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE
    );
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      image_url TEXT NOT NULL,
      gallery TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      category_id INTEGER
    );
  `);

  function getAsset(id: number): AssetEntry {
    return db
      .prepare(`
        SELECT assets.id, assets.title, assets.image_url AS imageUrl, assets.gallery, assets.description, assets.category_id AS categoryId, categories.name AS categoryName
        FROM assets
        LEFT JOIN categories ON categories.id = assets.category_id
        WHERE assets.id = ?
      `)
      .get(id) as AssetEntry;
  }

  function listAssets(): AssetEntry[] {
    return db
      .prepare(`
        SELECT assets.id, assets.title, assets.image_url AS imageUrl, assets.gallery, assets.description, assets.category_id AS categoryId, categories.name AS categoryName
        FROM assets
        LEFT JOIN categories ON categories.id = assets.category_id
        ORDER BY assets.id DESC
      `)
      .all() as AssetEntry[];
  }

  function addAsset(asset: NewAssetEntry): AssetEntry {
    const result = db
      .prepare("INSERT INTO assets (title, image_url, gallery, description, category_id) VALUES (?, ?, ?, ?, ?)")
      .run(asset.title.trim(), asset.imageUrl.trim(), asset.gallery.trim(), asset.description.trim(), asset.categoryId);
    return getAsset(Number(result.lastInsertRowid));
  }

  function updateAsset(id: number, asset: NewAssetEntry): AssetEntry | null {
    const result = db
      .prepare("UPDATE assets SET title = ?, image_url = ?, gallery = ?, description = ?, category_id = ? WHERE id = ?")
      .run(asset.title.trim(), asset.imageUrl.trim(), asset.gallery.trim(), asset.description.trim(), asset.categoryId, id);
    return result.changes === 0 ? null : getAsset(id);
  }

  function deleteAsset(id: number): boolean {
    return db.prepare("DELETE FROM assets WHERE id = ?").run(id).changes > 0;
  }

  return {
    addAsset,
    close: () => db.close(),
    deleteAsset,
    listAssets,
    updateAsset
  };
}
