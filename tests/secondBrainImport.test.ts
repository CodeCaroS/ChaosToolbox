import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createNoteStore } from "../server/noteStore";
import { syncSecondBrainNotes } from "../server/secondBrainImport";

test("second brain sync imports and updates markdown notes", () => {
  const root = mkdtempSync(join(tmpdir(), "chaostoolbox-second-brain-import-"));
  const vault = join(root, "second-brain");
  const dbPath = join(root, "notes.sqlite");
  mkdirSync(vault, { recursive: true });
  writeFileSync(join(vault, "README.md"), "# Vault Home\n\nStart here.");

  assert.deepEqual(syncSecondBrainNotes(dbPath, vault), { created: 1, updated: 0, unchanged: 0, deleted: 0, written: 0, conflicts: 0 });
  assert.deepEqual(syncSecondBrainNotes(dbPath, vault), { created: 0, updated: 0, unchanged: 1, deleted: 0, written: 0, conflicts: 0 });

  writeFileSync(join(vault, "README.md"), "---\ntitle: Better Home\n---\nUpdated body.");
  assert.deepEqual(syncSecondBrainNotes(dbPath, vault), { created: 0, updated: 1, unchanged: 0, deleted: 0, written: 0, conflicts: 0 });

  const notes = createNoteStore(dbPath);
  assert.deepEqual(notes.listNotes(), [
    {
      id: 1,
      title: "Better Home",
      body: "Updated body.",
      categoryId: 1,
      categoryName: "second-brain",
      sourcePath: "README.md"
    }
  ]);
  notes.close();
});

test("second brain sync exposes frontmatter metadata for filters", () => {
  const root = mkdtempSync(join(tmpdir(), "chaostoolbox-"));
  const vault = join(root, "second-brain");
  const dbPath = join(root, "notes.sqlite");
  mkdirSync(vault, { recursive: true });
  writeFileSync(join(vault, "agent.md"), "---\ntitle: Agent Note\nkind: knowledge\nstatus: active\ntags: [ai, workflow]\n---\nBody.");

  syncSecondBrainNotes(dbPath, vault);
  const notes = createNoteStore(dbPath);

  assert.deepEqual(notes.listNotes()[0]?.meta, {
    title: "Agent Note",
    kind: "knowledge",
    status: "active",
    tags: ["ai", "workflow"]
  });

  notes.close();
});

test("second brain sync updates notes when only markdown title changes", () => {
  const root = mkdtempSync(join(tmpdir(), "chaostoolbox-second-brain-title-"));
  const vault = join(root, "second-brain");
  const dbPath = join(root, "notes.sqlite");
  mkdirSync(vault, { recursive: true });
  writeFileSync(join(vault, "README.md"), "---\ntitle: Vault Home\n---\nStart here.");
  syncSecondBrainNotes(dbPath, vault);

  writeFileSync(join(vault, "README.md"), "---\ntitle: Better Home\n---\nStart here.");

  assert.deepEqual(syncSecondBrainNotes(dbPath, vault), { created: 0, updated: 1, unchanged: 0, deleted: 0, written: 0, conflicts: 0 });
  const notes = createNoteStore(dbPath);
  assert.equal(notes.listNotes()[0].title, "Better Home");
  notes.close();
});

test("second brain sync deletes local imported notes for removed files", () => {
  const root = mkdtempSync(join(tmpdir(), "chaostoolbox-second-brain-delete-"));
  const vault = join(root, "second-brain");
  const dbPath = join(root, "notes.sqlite");
  mkdirSync(vault, { recursive: true });
  writeFileSync(join(vault, "README.md"), "# Vault Home\n\nStart here.");
  syncSecondBrainNotes(dbPath, vault);

  rmSync(join(vault, "README.md"));

  assert.deepEqual(syncSecondBrainNotes(dbPath, vault), { created: 0, updated: 0, unchanged: 0, deleted: 1, written: 0, conflicts: 0 });
  const notes = createNoteStore(dbPath);
  assert.deepEqual(notes.listNotes(), []);
  notes.close();
});

test("second brain sync removes markdown files for deleted local imported notes", () => {
  const root = mkdtempSync(join(tmpdir(), "chaostoolbox-second-brain-local-delete-"));
  const vault = join(root, "second-brain");
  const dbPath = join(root, "notes.sqlite");
  mkdirSync(vault, { recursive: true });
  writeFileSync(join(vault, "README.md"), "# Vault Home\n\nStart here.");
  syncSecondBrainNotes(dbPath, vault);

  const notes = createNoteStore(dbPath);
  notes.deleteNote(1);
  notes.close();

  assert.deepEqual(syncSecondBrainNotes(dbPath, vault), { created: 0, updated: 0, unchanged: 0, deleted: 1, written: 0, conflicts: 0 });
  assert.equal(existsSync(join(vault, "README.md")), false);
});

test("second brain sync writes local note changes back to markdown files", () => {
  const root = mkdtempSync(join(tmpdir(), "chaostoolbox-second-brain-write-"));
  const vault = join(root, "second-brain");
  const dbPath = join(root, "notes.sqlite");
  mkdirSync(vault, { recursive: true });
  writeFileSync(join(vault, "README.md"), "# Vault Home\n\nStart here.");
  syncSecondBrainNotes(dbPath, vault);

  const notes = createNoteStore(dbPath);
  notes.updateNote(1, { title: "Local Home", body: "Local body.", categoryId: 1 });
  notes.close();

  assert.deepEqual(syncSecondBrainNotes(dbPath, vault), { created: 0, updated: 0, unchanged: 0, deleted: 0, written: 1, conflicts: 0 });
  assert.equal(readFileSync(join(vault, "README.md"), "utf8"), "---\ntitle: \"Local Home\"\nstatus: draft\ntags: []\n---\n\nLocal body.\n");
  assert.deepEqual(syncSecondBrainNotes(dbPath, vault), { created: 0, updated: 0, unchanged: 1, deleted: 0, written: 0, conflicts: 0 });
});

test("second brain sync moves refined ai-captures out of inbox", () => {
  const root = mkdtempSync(join(tmpdir(), "chaostoolbox-second-brain-refined-"));
  const vault = join(root, "second-brain");
  const dbPath = join(root, "notes.sqlite");
  mkdirSync(join(vault, "00-inbox", "ai-captures"), { recursive: true });
  writeFileSync(join(vault, "00-inbox", "ai-captures", "capture.md"), "---\ntitle: Capture\ntype: ai-capture\nstatus: inbox\ntags: []\n---\n\nInbox body.");
  syncSecondBrainNotes(dbPath, vault);

  const notes = createNoteStore(dbPath);
  notes.updateNote(1, {
    title: "Capture",
    body: "---\ntitle: \"Capture\"\nkind: ai-capture\nstatus: refined\ntags: []\n---\n\nReviewed body.",
    categoryId: 1
  });
  notes.close();

  assert.deepEqual(syncSecondBrainNotes(dbPath, vault), { created: 0, updated: 0, unchanged: 0, deleted: 0, written: 1, conflicts: 0 });
  assert.equal(existsSync(join(vault, "00-inbox", "ai-captures", "capture.md")), false);
  assert.equal(readFileSync(join(vault, "01-knowledge", "ai-captures", "capture.md"), "utf8"), "---\ntitle: \"Capture\"\nkind: ai-capture\nstatus: refined\ntags: []\n---\n\nReviewed body.\n");

  const synced = createNoteStore(dbPath);
  assert.equal(synced.listNotes()[0].sourcePath, "01-knowledge/ai-captures/capture.md");
  synced.close();
});

test("second brain sync nests refined knowledge notes by topic", () => {
  const root = mkdtempSync(join(tmpdir(), "chaostoolbox-second-brain-topic-"));
  const vault = join(root, "second-brain");
  const dbPath = join(root, "notes.sqlite");
  mkdirSync(join(vault, "00-inbox", "ai-captures"), { recursive: true });
  writeFileSync(join(vault, "00-inbox", "ai-captures", "capture.md"), "---\ntitle: Capture\ntype: ai-capture\nstatus: inbox\ntags: []\n---\n\nInbox body.");
  syncSecondBrainNotes(dbPath, vault);

  const notes = createNoteStore(dbPath);
  notes.updateNote(1, {
    title: "Capture",
    body: "---\ntitle: \"Capture\"\nkind: ai-capture\nstatus: refined\ntopic: LLM Workflows\ntags: []\n---\n\nReviewed body.",
    categoryId: 1
  });
  notes.close();

  assert.deepEqual(syncSecondBrainNotes(dbPath, vault), { created: 0, updated: 0, unchanged: 0, deleted: 0, written: 1, conflicts: 0 });
  assert.equal(existsSync(join(vault, "00-inbox", "ai-captures", "capture.md")), false);
  assert.equal(readFileSync(join(vault, "01-knowledge", "llm-workflows", "ai-captures", "capture.md"), "utf8"), "---\ntitle: \"Capture\"\nkind: ai-capture\nstatus: refined\ntopic: LLM Workflows\ntags: []\n---\n\nReviewed body.\n");

  const synced = createNoteStore(dbPath);
  assert.equal(synced.listNotes()[0].sourcePath, "01-knowledge/llm-workflows/ai-captures/capture.md");
  synced.close();
});

test("second brain sync does not overwrite when file and note both changed", () => {
  const root = mkdtempSync(join(tmpdir(), "chaostoolbox-second-brain-conflict-"));
  const vault = join(root, "second-brain");
  const dbPath = join(root, "notes.sqlite");
  mkdirSync(vault, { recursive: true });
  writeFileSync(join(vault, "README.md"), "# Vault Home\n\nStart here.");
  syncSecondBrainNotes(dbPath, vault);

  const notes = createNoteStore(dbPath);
  notes.updateNote(1, { title: "Local Home", body: "Local body.", categoryId: 1 });
  notes.close();
  writeFileSync(join(vault, "README.md"), "# Repo Home\n\nRepo body.");

  assert.deepEqual(syncSecondBrainNotes(dbPath, vault), { created: 0, updated: 0, unchanged: 0, deleted: 0, written: 0, conflicts: 1 });
  assert.equal(readFileSync(join(vault, "README.md"), "utf8"), "# Repo Home\n\nRepo body.");
  assert.equal(existsSync(join(vault, "README.md")), true);
});
