import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import type { NoteEntry, NoteMetadata } from "../src/modules/notes/types";

export type SecondBrainNoteFile = {
  path: string;
  title: string;
  body: string;
  meta: NoteMetadata;
  contentHash: string;
};

export function listSecondBrainNotes(root: string): NoteEntry[] {
  return scanSecondBrainNotes(root).map((note, index) => ({
    id: -(index + 1),
    title: note.title,
    body: note.body,
    categoryId: null,
    categoryName: "second-brain"
  }));
}

export function scanSecondBrainNotes(root: string): SecondBrainNoteFile[] {
  if (!existsSync(root)) return [];

  return markdownFiles(root).map((path) => {
    const raw = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
    const markdown = parseMarkdown(raw);
    const body = markdown.body;
    return {
      path: relative(root, path).replace(/\\/g, "/"),
      title: markdown.title || titleFromMarkdown(path, body),
      body,
      meta: markdown.meta,
      contentHash: createHash("sha256").update(raw).digest("hex")
    };
  });
}

function markdownFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (directory: string) => {
    for (const name of readdirSync(directory).sort()) {
      if (name.startsWith(".")) continue;
      const path = join(directory, name);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if ([".md", ".mdx"].includes(extname(path).toLowerCase())) {
        files.push(path);
      }
    }
  };

  walk(root);
  return files.sort((a, b) => {
    const left = relative(root, a);
    const right = relative(root, b);
    return depth(left) - depth(right) || readmeRank(left) - readmeRank(right) || left.localeCompare(right);
  });
}

function parseMarkdown(body: string): { body: string; title: string | null; meta: NoteMetadata } {
  const match = body.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { body, title: null, meta: {} };

  const meta = parseFrontmatter(match[1]);
  return { body: body.slice(match[0].length).trimStart(), title: meta.title ?? null, meta };
}

function titleFromMarkdown(path: string, body: string): string {
  const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || basename(path, extname(path)).replace(/[-_]+/g, " ");
}

function depth(path: string): number {
  return path.split(/[\\/]/).length;
}

function readmeRank(path: string): number {
  return basename(path).toLowerCase() === "readme.md" ? 0 : 1;
}

function parseFrontmatter(value: string): NoteMetadata {
  const meta: NoteMetadata = {};
  const lines = value.split("\n");
  for (let index = 0; index < lines.length; index++) {
    const pair = lines[index]?.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!pair) continue;
    const key = pair[1] as keyof NoteMetadata;
    let raw = pair[2].trim();
    while (!raw && lines[index + 1]?.match(/^\s*-\s+/)) {
      index++;
      raw += `${raw ? "," : ""}${lines[index].replace(/^\s*-\s+/, "").trim()}`;
    }
    const clean = stripQuotes(raw);
    if (key === "tags") meta.tags = clean.replace(/^\[/, "").replace(/\]$/, "").split(",").map((tag) => stripQuotes(tag.trim())).filter(Boolean);
    else if (["title", "kind", "status", "sourceType", "summary", "description"].includes(key)) meta[key] = clean;
  }
  return meta;
}

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, "").trim();
}
