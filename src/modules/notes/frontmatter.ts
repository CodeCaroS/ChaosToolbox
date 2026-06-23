import type { NoteMetadata } from "./types";

export type NoteFormMetadata = Pick<NoteMetadata, "title" | "kind" | "status" | "topic" | "tags" | "summary" | "extraYaml">;

export function parseNoteMarkdown(markdown: string, fallbackTitle: string): { body: string; meta: NoteFormMetadata } {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  const parsed = match ? parseFrontmatter(match[1]) : {};
  return {
    body: match ? markdown.slice(match[0].length).trimStart() : markdown,
    meta: {
      title: parsed.title || fallbackTitle,
      kind: parsed.kind || "knowledge",
      status: parsed.status || "draft",
      topic: parsed.topic || "",
      tags: parsed.tags ?? [],
      summary: parsed.summary || "",
      ...(parsed.extraYaml ? { extraYaml: parsed.extraYaml } : {})
    }
  };
}

export function serializeNoteMarkdown(meta: NoteFormMetadata, body: string): string {
  const lines = [
    "---",
    `title: ${quoteYaml(meta.title ?? "")}`,
    ...(meta.kind ? [`kind: ${meta.kind}`] : []),
    ...(meta.status ? [`status: ${meta.status}`] : []),
    ...(meta.topic ? [`topic: ${meta.topic}`] : []),
    `tags: [${(meta.tags ?? []).join(", ")}]`,
    ...(meta.summary ? [`summary: ${quoteYaml(meta.summary)}`] : []),
    ...(meta.extraYaml?.trim() ? [meta.extraYaml.trim()] : []),
    "---",
    "",
    body
  ];
  return lines.join("\n");
}

function parseFrontmatter(value: string): NoteFormMetadata {
  const meta: NoteFormMetadata = {};
  let listKey: keyof NoteFormMetadata | null = null;
  const extraBlocks: string[] = [];
  const blocks = splitTopLevelBlocks(value);

  for (const block of blocks) {
    const name = block.match(/^([A-Za-z][\w-]*):/)?.[1];
    if (name && !["title", "type", "kind", "status", "topic", "tags", "summary"].includes(name)) extraBlocks.push(block);
  }

  for (const line of value.split("\n")) {
    const listItem = line.match(/^\s+-\s*(.*)$/);
    if (listKey === "tags" && listItem) {
      meta.tags = [...(meta.tags ?? []), stripQuotes(listItem[1].trim())].filter(Boolean);
      continue;
    }

    const pair = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!pair) {
      if (!line.startsWith(" ")) listKey = null;
      continue;
    }
    const key = (pair[1] === "type" ? "kind" : pair[1]) as keyof NoteFormMetadata;
    const raw = stripQuotes(pair[2].trim());
    listKey = raw ? null : key;
    if (key === "tags") meta.tags = raw.replace(/^\[/, "").replace(/\]$/, "").split(",").map((tag) => stripQuotes(tag.trim())).filter(Boolean);
    else if (["title", "kind", "status", "topic", "summary"].includes(key)) meta[key] = raw as never;
  }
  const extraYaml = extraBlocks.join("\n").trim();
  if (extraYaml) meta.extraYaml = extraYaml;
  return meta;
}

function splitTopLevelBlocks(value: string): string[] {
  const blocks: string[] = [];
  let block: string[] = [];
  for (const line of value.split("\n")) {
    if (/^[A-Za-z][\w-]*:/.test(line) && block.length) {
      blocks.push(block.join("\n"));
      block = [];
    }
    block.push(line);
  }
  if (block.length) blocks.push(block.join("\n"));
  return blocks.filter((item) => item.trim());
}

function quoteYaml(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, "").trim();
}
