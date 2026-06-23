import { test } from "node:test";
import assert from "node:assert/strict";
import { applySuggestedNoteMetadata } from "../src/modules/notes/noteMetadataForm";

test("applySuggestedNoteMetadata only fills empty fields and extends tags", () => {
  const form = {
    title: "Existing title",
    kind: "project",
    status: "active",
    topic: "Existing topic",
    tags: "ai, notes",
    summary: "Existing summary",
    extraYaml: "existing: true"
  };

  applySuggestedNoteMetadata(form, {
    title: "Suggested title",
    kind: "knowledge",
    status: "draft",
    topic: "Suggested topic",
    tags: ["notes", "research"],
    summary: "Suggested summary",
    extraYaml: "suggested: true"
  });

  assert.deepEqual(form, {
    title: "Existing title",
    kind: "project",
    status: "active",
    topic: "Existing topic",
    tags: "ai, notes, research",
    summary: "Existing summary",
    extraYaml: "existing: true"
  });
});
