import type Database from "better-sqlite3";

export type ArtifactInput = {
  entityType: string;
  entityId: number;
  type: string;
  title: string;
  status?: string;
  summary?: string;
};

export type ArtifactRow = {
  id: number;
  entityType: string;
  entityId: number;
  type: string;
  title: string;
  status: string;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ArtifactRelationRow = {
  id: number;
  fromArtifactId: number;
  toArtifactId: number;
  type: string;
  createdAt: string;
};

export type ReviewQueueRow = ArtifactRow & {
  reviewStage: string;
  reviewOrder: number;
};

export function ensureArtifactCore(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS artifacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      summary TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(entity_type, entity_id)
    );
    CREATE TABLE IF NOT EXISTS artifact_relations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_artifact_id INTEGER NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
      to_artifact_id INTEGER NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(from_artifact_id, to_artifact_id, type)
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS artifact_search USING fts5(
      title,
      summary,
      type,
      status,
      entity_type,
      tags
    );
  `);
}

export function upsertArtifact(db: Database.Database, input: ArtifactInput): ArtifactRow {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO artifacts (entity_type, entity_id, type, title, status, summary, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(entity_type, entity_id) DO UPDATE SET
      type = excluded.type,
      title = excluded.title,
      status = excluded.status,
      summary = excluded.summary,
      updated_at = excluded.updated_at
  `).run(
    input.entityType,
    input.entityId,
    input.type,
    input.title.trim(),
    input.status ?? "draft",
    input.summary ?? null,
    now,
    now
  );
  db.prepare(`
    INSERT OR REPLACE INTO artifact_search (rowid, title, summary, type, status, entity_type, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    getArtifactByEntity(db, input.entityType, input.entityId).id,
    input.title.trim(),
    input.summary ?? "",
    input.type,
    input.status ?? "draft",
    input.entityType,
    ""
  );
  return getArtifactByEntity(db, input.entityType, input.entityId);
}

export function deleteArtifactForEntity(db: Database.Database, entityType: string, entityId: number): boolean {
  const artifact = db.prepare("SELECT id FROM artifacts WHERE entity_type = ? AND entity_id = ?").get(entityType, entityId) as { id: number } | undefined;
  const deleted = db.prepare("DELETE FROM artifacts WHERE entity_type = ? AND entity_id = ?").run(entityType, entityId).changes > 0;
  if (deleted && artifact) {
    db.prepare("DELETE FROM artifact_search WHERE rowid = ?").run(artifact.id);
  }
  return deleted;
}

export function listArtifacts(db: Database.Database): ArtifactRow[] {
  return db.prepare("SELECT id, entity_type AS entityType, entity_id AS entityId, type, title, status, summary, created_at AS createdAt, updated_at AS updatedAt FROM artifacts ORDER BY id DESC").all() as ArtifactRow[];
}

export function listReviewQueue(db: Database.Database): ReviewQueueRow[] {
  return listArtifacts(db)
    .map((artifact) => ({ ...artifact, reviewOrder: reviewOrder(artifact.status), reviewStage: reviewStage(artifact.status) }))
    .filter((artifact) => artifact.reviewOrder < Infinity)
    .sort((left, right) => left.reviewOrder - right.reviewOrder || right.id - left.id);
}

export function updateArtifactStatus(db: Database.Database, entityType: string, entityId: number, status: string): ArtifactRow | null {
  const artifact = db.prepare(`
    SELECT id, entity_type AS entityType, entity_id AS entityId, type, title, status, summary, created_at AS createdAt, updated_at AS updatedAt
    FROM artifacts
    WHERE entity_type = ? AND entity_id = ?
  `).get(entityType, entityId) as ArtifactRow | undefined;
  if (!artifact) {
    return null;
  }
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE artifacts
    SET status = ?, updated_at = ?
    WHERE entity_type = ? AND entity_id = ?
  `).run(status, now, entityType, entityId);
  db.prepare(`
    INSERT OR REPLACE INTO artifact_search (rowid, title, summary, type, status, entity_type, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(artifact.id, artifact.title, artifact.summary ?? "", artifact.type, status, artifact.entityType, "");
  return {
    ...artifact,
    status,
    updatedAt: now
  };
}

export function addArtifactRelation(db: Database.Database, fromArtifactId: number, toArtifactId: number, type: string): ArtifactRelationRow {
  const createdAt = new Date().toISOString();
  const result = db.prepare(`
    INSERT OR IGNORE INTO artifact_relations (from_artifact_id, to_artifact_id, type, created_at)
    VALUES (?, ?, ?, ?)
  `).run(fromArtifactId, toArtifactId, type, createdAt);
  const row = db.prepare(`
    SELECT id, from_artifact_id AS fromArtifactId, to_artifact_id AS toArtifactId, type, created_at AS createdAt
    FROM artifact_relations
    WHERE from_artifact_id = ? AND to_artifact_id = ? AND type = ?
  `).get(fromArtifactId, toArtifactId, type) as ArtifactRelationRow | undefined;
  if (!row) {
    throw new Error("artifact relation missing");
  }
  return row;
}

export function listArtifactRelations(db: Database.Database): ArtifactRelationRow[] {
  return db.prepare("SELECT id, from_artifact_id AS fromArtifactId, to_artifact_id AS toArtifactId, type, created_at AS createdAt FROM artifact_relations ORDER BY id").all() as ArtifactRelationRow[];
}

function getArtifactByEntity(db: Database.Database, entityType: string, entityId: number): ArtifactRow {
  const row = db.prepare(`
    SELECT id, entity_type AS entityType, entity_id AS entityId, type, title, status, summary, created_at AS createdAt, updated_at AS updatedAt
    FROM artifacts
    WHERE entity_type = ? AND entity_id = ?
  `).get(entityType, entityId) as ArtifactRow | undefined;
  if (!row) {
    throw new Error("artifact missing");
  }
  return row;
}

function reviewOrder(status: string): number {
  const order: Record<string, number> = {
    captured: 0,
    inbox: 0,
    new: 0,
    draft: 1,
    saved: 1,
    active: 1,
    triaged: 2,
    review: 2,
    refined: 2,
    refine: 2,
    extracted: 3,
    connected: 4,
    proposed: 5
  };
  return Object.prototype.hasOwnProperty.call(order, status) ? order[status] : Infinity;
}

function reviewStage(status: string): string {
  const stage: Record<string, string> = {
    captured: "captured",
    inbox: "captured",
    new: "captured",
    draft: "triaged",
    saved: "triaged",
    active: "triaged",
    triaged: "triaged",
    review: "extracted",
    refined: "extracted",
    refine: "extracted",
    extracted: "connected",
    connected: "reviewed",
    reviewed: "reviewed",
    keep: "reviewed",
    proposed: "reviewed",
    committed: "committed"
  };
  return stage[status] ?? status;
}
