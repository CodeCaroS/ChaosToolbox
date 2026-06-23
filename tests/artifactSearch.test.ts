import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import Database from "better-sqlite3";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { ensureArtifactCore, upsertArtifact } from "../server/artifactCore";
import { savedArtifactSearches, searchArtifacts } from "../server/artifactSearch";

test("artifact search matches indexed text and saved searches", () => {
  const filename = join(mkdtempSync(join(tmpdir(), "chaostoolbox-")), "search.sqlite");
  const db = new Database(filename);

  ensureArtifactCore(db);
  upsertArtifact(db, {
    entityId: 1,
    entityType: "note",
    type: "note",
    title: "Inbox review",
    status: "triaged",
    summary: "Process the captured note"
  });
  upsertArtifact(db, {
    entityId: 2,
    entityType: "source",
    type: "source",
    title: "A useful article",
    status: "archived",
    summary: "Local-first sync and review"
  });

  assert.deepEqual(searchArtifacts(db, "local-first").map((artifact) => artifact.title), ["A useful article"]);
  assert.deepEqual(searchArtifacts(db, savedArtifactSearches().find((search) => search.id === "inbox-review")!.query).map((artifact) => artifact.title), ["Inbox review"]);
  assert.deepEqual(searchArtifacts(db, savedArtifactSearches().find((search) => search.id === "review-queue")!.query).map((artifact) => artifact.title), ["Inbox review"]);

  db.close();
});
