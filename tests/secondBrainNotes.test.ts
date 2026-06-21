import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { listSecondBrainNotes } from "../server/secondBrainNotes";

test("lists markdown notes from the second brain checkout", () => {
  const root = mkdtempSync(join(tmpdir(), "chaostoolbox-second-brain-"));
  mkdirSync(join(root, "01-knowledge"), { recursive: true });
  mkdirSync(join(root, ".obsidian"), { recursive: true });
  writeFileSync(join(root, "README.md"), "# Vault Home\n\nStart here.");
  writeFileSync(join(root, "frontmatter.md"), "---\ntitle: Frontmatter Title\n---\nSaved body.");
  writeFileSync(join(root, "quoted.md"), "---\ntitle: 'Quoted Title'\n---\nQuoted body.");
  writeFileSync(join(root, "01-knowledge", "plain-note.md"), "No heading yet.");
  writeFileSync(join(root, ".obsidian", "ignored.md"), "# Hidden");
  writeFileSync(join(root, "not-markdown.txt"), "# Nope");

  assert.deepEqual(listSecondBrainNotes(root), [
    {
      id: -1,
      title: "Vault Home",
      body: "# Vault Home\n\nStart here.",
      categoryId: null,
      categoryName: "second-brain"
    },
    {
      id: -2,
      title: "Frontmatter Title",
      body: "Saved body.",
      categoryId: null,
      categoryName: "second-brain"
    },
    {
      id: -3,
      title: "Quoted Title",
      body: "Quoted body.",
      categoryId: null,
      categoryName: "second-brain"
    },
    {
      id: -4,
      title: "plain note",
      body: "No heading yet.",
      categoryId: null,
      categoryName: "second-brain"
    }
  ]);
});
