import type Database from "better-sqlite3";
import type { ArtifactRow } from "./artifactCore";

export type SavedArtifactSearch = {
  id: string;
  label: string;
  query: string;
};

export function searchArtifacts(db: Database.Database, query: string): ArtifactRow[] {
  const normalized = query.trim().replace(/-/g, " ").replace(/\s+/g, " ");
  if (!normalized) {
    return [];
  }
  return db.prepare(`
    SELECT artifacts.id, artifacts.entity_type AS entityType, artifacts.entity_id AS entityId, artifacts.type, artifacts.title, artifacts.status, artifacts.summary, artifacts.created_at AS createdAt, artifacts.updated_at AS updatedAt
    FROM artifact_search
    JOIN artifacts ON artifacts.id = artifact_search.rowid
    WHERE artifact_search MATCH ?
    ORDER BY artifacts.id DESC
  `).all(normalized) as ArtifactRow[];
}

export function savedArtifactSearches(): SavedArtifactSearch[] {
  return [
    { id: "inbox-review", label: "Inbox Review", query: "status:captured OR status:inbox OR status:triaged" },
    { id: "review-queue", label: "Review Queue", query: "status:captured OR status:inbox OR status:draft OR status:triaged OR status:review OR status:refine" },
    { id: "knowledge-debt", label: "Knowledge Debt", query: "status:refine OR status:draft" },
    { id: "open-decisions", label: "Open Decisions", query: 'type:decision AND status:proposed' }
  ];
}
