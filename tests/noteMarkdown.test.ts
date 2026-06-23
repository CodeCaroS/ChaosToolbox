import { test } from "node:test";
import assert from "node:assert/strict";
import { fixMarkdownLint, normalizeMarkdownHeaders, prepareNoteMarkdown } from "../server/noteMarkdown";

test("prepareNoteMarkdown adds frontmatter to new notes", async () => {
  const result = await prepareNoteMarkdown("Build notes", "Keep it small.");

  assert.deepEqual(result.errors, []);
  assert.match(result.body, /^---\ntitle: "Build notes"\nstatus: draft\ntags: \[\]\n---\n\nKeep it small\./);
});

test("prepareNoteMarkdown keeps existing frontmatter and adds missing title", async () => {
  const result = await prepareNoteMarkdown("Build notes", "---\nstatus: active\n---\n\nBody.");

  assert.deepEqual(result.errors, []);
  assert.match(result.body, /^---\ntitle: "Build notes"\nstatus: active\n---\n\nBody\./);
});

test("prepareNoteMarkdown reports markdown lint errors", async () => {
  const result = await prepareNoteMarkdown("Bad", "# Good\n\n### Skipped level");

  assert.ok(result.errors.some((error) => error.includes("MD001")));
});

test("prepareNoteMarkdown allows multiple top-level headings", async () => {
  const result = await prepareNoteMarkdown("Title", "# One\n\n# Two");

  assert.deepEqual(result.errors, []);
});

test("prepareNoteMarkdown allows repeated child headings in different sections", async () => {
  const result = await prepareNoteMarkdown("Title", "# A\n\n## Events\n\n# B\n\n## Events");

  assert.deepEqual(result.errors, []);
});

test("fixMarkdownLint auto-fixes fixable markdown lint errors", async () => {
  assert.equal(await fixMarkdownLint("#Bad heading"), "# Bad heading\n");
});

test("prepareNoteMarkdown auto-fixes before reporting lint errors", async () => {
  const result = await prepareNoteMarkdown("Bad", "##Bad heading");

  assert.deepEqual(result.errors, []);
  assert.match(result.body, /\n## Bad heading\n$/);
});

test("normalizeMarkdownHeaders runs markdown lint fixes then closes skipped heading levels", async () => {
  assert.equal(await normalizeMarkdownHeaders("#Title\n\n### Deep\n\n##### Deeper"), "# Title\n\n## Deep\n\n### Deeper\n");
});

test("normalizeMarkdownHeaders leaves frontmatter and fenced code alone", async () => {
  assert.equal(
    await normalizeMarkdownHeaders("---\ntitle: # Nope\n---\n\n# Title\n\n```md\n### Code\n```\n\n#### Deep"),
    "---\ntitle: # Nope\n---\n\n# Title\n\n```md\n### Code\n```\n\n## Deep\n"
  );
});
