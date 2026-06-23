import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import Database from "better-sqlite3";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createLinkStore } from "../server/linkStore";

test("link store mirrors sources into the shared artifact core", () => {
  const filename = join(mkdtempSync(join(tmpdir(), "chaostoolbox-")), "links.sqlite");
  const links = createLinkStore(filename);
  const db = new Database(filename);

  const saved = links.addLink({ title: "Process memo", description: "Source capture", url: "https://example.com", categoryId: null, tags: ["status:inbox"] });
  const artifact = db.prepare("SELECT entity_type AS entityType, entity_id AS entityId, title, type, status FROM artifacts WHERE entity_type = ? AND entity_id = ?").get("source", saved.id) as { entityType: string; entityId: number; title: string; type: string; status: string };

  assert.deepEqual(artifact, {
    entityType: "source",
    entityId: saved.id,
    title: "Process memo",
    type: "source",
    status: "inbox"
  });

  links.updateLink(saved.id, { title: "Updated memo", description: "Updated", url: "https://example.com", categoryId: null, tags: ["status:keep"] });
  const updated = db.prepare("SELECT title, status FROM artifacts WHERE entity_type = ? AND entity_id = ?").get("source", saved.id) as { title: string; status: string };
  assert.deepEqual(updated, { title: "Updated memo", status: "keep" });

  links.deleteLink(saved.id);
  const missing = db.prepare("SELECT count(*) AS count FROM artifacts WHERE entity_type = ? AND entity_id = ?").get("source", saved.id) as { count: number };
  assert.equal(missing.count, 0);

  db.close();
  links.close();
});
