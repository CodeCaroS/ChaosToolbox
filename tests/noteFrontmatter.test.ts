import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNoteMarkdown, serializeNoteMarkdown } from "../src/modules/notes/frontmatter";

test("parseNoteMarkdown splits frontmatter from body", () => {
  assert.deepEqual(parseNoteMarkdown("---\ntitle: Home\nkind: knowledge\nstatus: active\ntopic: AI Strategy\ntags: [ai, workflow]\nsummary: Short\n---\n\nBody.", "Fallback"), {
    body: "Body.",
    meta: {
      title: "Home",
      kind: "knowledge",
      status: "active",
      topic: "AI Strategy",
      tags: ["ai", "workflow"],
      summary: "Short"
    }
  });
});

test("parseNoteMarkdown maps pasted yaml frontmatter to form metadata", () => {
  assert.deepEqual(parseNoteMarkdown(`---
id: ai-capture-2026-06-21-tiktok-ai-weekly-learning-loop
type: ai-capture
title: "AI als woechentliches Lernsystem nutzen"
created: 2026-06-21
status: review
summary: "Ein AI-Chief-of-Staff-System sollte woechentlich lernen."
tags:
  - ai
  - second-brain
  - weekly-review
source:
  type: tiktok
---

Body.`, "Fallback"), {
    body: "Body.",
    meta: {
      title: "AI als woechentliches Lernsystem nutzen",
      kind: "ai-capture",
      status: "review",
      topic: "",
      tags: ["ai", "second-brain", "weekly-review"],
      summary: "Ein AI-Chief-of-Staff-System sollte woechentlich lernen.",
      extraYaml: "id: ai-capture-2026-06-21-tiktok-ai-weekly-learning-loop\ncreated: 2026-06-21\nsource:\n  type: tiktok"
    }
  });
});

test("serializeNoteMarkdown writes frontmatter from form values", () => {
  assert.equal(serializeNoteMarkdown({
    title: "Home",
    kind: "knowledge",
    status: "active",
    topic: "AI Strategy",
    tags: ["ai", "workflow"],
    summary: "Short",
    extraYaml: "source:\n  type: tiktok\nrelated: []"
  }, "Body."), "---\ntitle: \"Home\"\nkind: knowledge\nstatus: active\ntopic: AI Strategy\ntags: [ai, workflow]\nsummary: \"Short\"\nsource:\n  type: tiktok\nrelated: []\n---\n\nBody.");
});
