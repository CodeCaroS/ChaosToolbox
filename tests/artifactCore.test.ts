import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import Database from "better-sqlite3";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { addArtifactRelation, ensureArtifactCore, listArtifactRelations, listArtifacts, listReviewQueue, updateArtifactStatus, upsertArtifact } from "../server/artifactCore";

test("artifact core stores artifacts and relations", () => {
  const filename = join(mkdtempSync(join(tmpdir(), "chaostoolbox-")), "artifacts.sqlite");
  const db = new Database(filename);

  ensureArtifactCore(db);
  const note = upsertArtifact(db, {
    entityId: 1,
    entityType: "note",
    title: "Build notes",
    type: "note",
    status: "inbox",
    summary: "Keep it small."
  });
  const source = upsertArtifact(db, {
    entityId: 2,
    entityType: "source",
    title: "Source link",
    type: "source",
    status: "captured",
    summary: "From the inbox."
  });

  addArtifactRelation(db, note.id, source.id, "derived_from");

  assert.deepEqual(listArtifacts(db).map(({ id, entityType, entityId, title, type, status, summary }) => ({
    id,
    entityType,
    entityId,
    title,
    type,
    status,
    summary
  })), [
    { id: source.id, entityType: "source", entityId: 2, title: "Source link", type: "source", status: "captured", summary: "From the inbox." },
    { id: note.id, entityType: "note", entityId: 1, title: "Build notes", type: "note", status: "inbox", summary: "Keep it small." }
  ]);
  assert.deepEqual(listArtifactRelations(db), [
    {
      id: 1,
      fromArtifactId: note.id,
      toArtifactId: source.id,
      type: "derived_from",
      createdAt: listArtifactRelations(db)[0]?.createdAt
    }
  ]);

  assert.deepEqual(listReviewQueue(db).map(({ entityType, entityId, status, reviewStage }) => ({ entityType, entityId, status, reviewStage })), [
    { entityType: "source", entityId: 2, status: "captured", reviewStage: "captured" },
    { entityType: "note", entityId: 1, status: "inbox", reviewStage: "captured" }
  ]);
  const updatedSource = updateArtifactStatus(db, "source", 2, "committed");
  assert.equal(updatedSource?.status, "committed");
  assert.equal(listReviewQueue(db).some(({ entityType, entityId }) => entityType === "source" && entityId === 2), false);
  assert.equal(updateArtifactStatus(db, "note", 1, "archived")?.status, "archived");

  db.close();
});
