import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import type { NoteEntry } from "../src/modules/notes/types";

export type SecondBrainNoteFile = {
  path: string;
  title: string;
  body: string;
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
    const markdown = parseMarkdown(readFileSync(path, "utf8").replace(/\r\n/g, "\n"));
    const body = markdown.body;
    return {
      path: relative(root, path).replace(/\\/g, "/"),
      title: markdown.title || titleFromMarkdown(path, body),
      body,
      contentHash: createHash("sha256").update(body).digest("hex")
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
      } else if (extname(path).toLowerCase() === ".md") {
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

function parseMarkdown(body: string): { body: string; title: string | null } {
  const match = body.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { body, title: null };

  const title = match[1].match(/^title:\s*"?([^"\n]+)"?\s*$/m)?.[1]?.trim() ?? null;
  return { body: body.slice(match[0].length).trimStart(), title };
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
