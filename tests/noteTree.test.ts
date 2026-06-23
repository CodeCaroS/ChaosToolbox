import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNoteTree,
  defaultNoteTreeFilters,
  defaultNoteTreeOptions,
  extractNoteFacets,
  type NoteTreeFilters
} from "../src/modules/notes/noteTree";
import type { NoteEntry } from "../src/modules/notes/types";

const notes: NoteEntry[] = [
  {
    id: 1,
    title: "Agent Loops",
    body: "---\ntags: [ai, workflow]\nstatus: active\n---\nBody",
    categoryId: null,
    categoryName: null,
    sourcePath: "01-knowledge/concepts/agent-loops.md"
  },
  {
    id: 2,
    title: "Archived Prompt",
    body: "---\ntags:\n  - ai\nstatus: archived\n---\nBody",
    categoryId: null,
    categoryName: null,
    sourcePath: "99-archive/prompt.md"
  },
  {
    id: 3,
    title: "Project Workflow",
    body: "---\ntags: [workflow]\nstatus: active\n---\nNo metadata.",
    categoryId: null,
    categoryName: null,
    sourcePath: "03-projects/nodarium/workflow.mdx"
  },
  {
    id: 4,
    title: "TikTok Capture",
    body: "---\ntags: [tiktok]\n---\nBody",
    categoryId: null,
    categoryName: null,
    sourcePath: "00-inbox/ai-captures/tiktok-capture.md"
  }
];

test("buildNoteTree filters without mutating notes and keeps matching parents visible", () => {
  const before = JSON.stringify(notes);
  const filters: NoteTreeFilters = { ...defaultNoteTreeFilters, query: "agent" };

  const tree = buildNoteTree(notes, filters, { ...defaultNoteTreeOptions, showEmptyFolders: false });

  assert.equal(JSON.stringify(notes), before);
  assert.deepEqual(tree.map((node) => node.path), ["01-knowledge"]);
  assert.equal(tree[0]?.children?.[0]?.path, "01-knowledge/concepts");
  assert.equal(tree[0]?.children?.[0]?.children?.[0]?.name, "agent-loops.md");
});

test("buildNoteTree combines extension, kind, tag, status and archive filters", () => {
  const tree = buildNoteTree(notes, {
    ...defaultNoteTreeFilters,
    extensions: [".mdx"],
    kinds: ["project"],
    tags: ["workflow"],
    statuses: ["active"],
    includeArchive: false
  }, { ...defaultNoteTreeOptions, showEmptyFolders: false });

  assert.equal(tree[0]?.path, "03-projects");
  assert.equal(tree[0]?.children?.[0]?.children?.[0]?.note?.id, 3);
});

test("buildNoteTree treats 00-inbox notes as inbox status", () => {
  const tree = buildNoteTree(notes, {
    ...defaultNoteTreeFilters,
    statuses: ["inbox"]
  }, { ...defaultNoteTreeOptions, showEmptyFolders: false });

  assert.equal(tree[0]?.path, "00-inbox");
  assert.equal(tree[0]?.children?.[0]?.children?.[0]?.note?.id, 4);
});

test("buildNoteTree can keep folders emptied by filters", () => {
  const tree = buildNoteTree(notes, {
    ...defaultNoteTreeFilters,
    query: "agent"
  }, { ...defaultNoteTreeOptions, showEmptyFolders: true });

  assert.deepEqual(tree.map((node) => node.path), ["00-inbox", "01-knowledge", "03-projects"]);
  assert.equal(tree[2]?.children?.[0]?.children?.length, 0);
});

test("extractNoteFacets collects real and inferred facets", () => {
  assert.deepEqual(extractNoteFacets(notes), {
    extensions: [".md", ".mdx"],
    kinds: ["archive", "knowledge", "project", "unknown"],
    statuses: ["active", "archived", "inbox"],
    tags: ["ai", "tiktok", "workflow"]
  });
});
