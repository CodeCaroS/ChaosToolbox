import type { NoteEntry } from "./types";

export type NoteNodeType = "folder" | "note";
export type NoteKind = "knowledge" | "source" | "project" | "decision" | "task" | "review" | "archive" | "unknown";
export type NoteStatus = "inbox" | "draft" | "active" | "review" | "refined" | "archived" | "keep" | "refine" | "archive" | "unknown";

export type NoteTreeNode = {
  id: string;
  name: string;
  path: string;
  type: NoteNodeType;
  extension?: string;
  depth: number;
  parentPath?: string;
  children?: NoteTreeNode[];
  note?: NoteEntry;
  meta?: {
    title?: string;
    kind?: NoteKind;
    status?: NoteStatus;
    tags?: string[];
    sourceType?: string;
    summary?: string;
  };
};

export type NoteTreeFilters = {
  query: string;
  extensions: string[];
  kinds: NoteKind[];
  statuses: NoteStatus[];
  tags: string[];
  tagMode: "and" | "or";
  includeArchive: boolean;
};

export type NoteTreeOptions = {
  foldersFirst: boolean;
  alphabetical: boolean;
  showEmptyFolders: boolean;
  showFullPath: boolean;
  notesOnly: boolean;
};

export type NoteTreeFacets = {
  extensions: string[];
  kinds: NoteKind[];
  statuses: NoteStatus[];
  tags: string[];
};

export const defaultNoteTreeFilters: NoteTreeFilters = {
  query: "",
  extensions: [],
  kinds: [],
  statuses: [],
  tags: [],
  tagMode: "or",
  includeArchive: false
};

export const defaultNoteTreeOptions: NoteTreeOptions = {
  foldersFirst: true,
  alphabetical: true,
  showEmptyFolders: true,
  showFullPath: false,
  notesOnly: false
};

const KIND_BY_FOLDER: Record<string, NoteKind> = {
  "01-knowledge": "knowledge",
  "02-sources": "source",
  "03-projects": "project",
  "04-decisions": "decision",
  "05-tasks": "task",
  "06-reviews": "review",
  "99-archive": "archive"
};

const NOTE_KINDS: NoteKind[] = ["knowledge", "source", "project", "decision", "task", "review", "archive", "unknown"];
const NOTE_STATUSES: NoteStatus[] = ["inbox", "draft", "active", "review", "refined", "archived", "keep", "refine", "archive", "unknown"];

export function buildNoteTree(notes: NoteEntry[], filters: NoteTreeFilters, options: NoteTreeOptions): NoteTreeNode[] {
  const root: NoteTreeNode[] = [];
  const byPath = new Map<string, NoteTreeNode>();

  for (const note of notes) {
    const path = noteTreePath(note);
    const meta = noteMetadata(note);
    const node = noteNode(note, path, meta);
    if (archiveHidden(node, filters)) continue;

    const segments = path.split(/[\\/]+/g).map((segment) => segment.trim()).filter(Boolean);
    const fileName = segments.pop() || note.title;
    let siblings = root;
    let parentPath = "";

    for (const segment of segments) {
      const folderPath = parentPath ? `${parentPath}/${segment}` : segment;
      let folder = byPath.get(folderPath);
      if (!folder) {
        folder = {
          id: folderPath,
          name: segment,
          path: folderPath,
          type: "folder",
          depth: folderPath.split("/").length - 1,
          parentPath: parentPath || undefined,
          children: []
        };
        byPath.set(folderPath, folder);
        siblings.push(folder);
      }
      siblings = folder.children ?? [];
      parentPath = folderPath;
    }

    if (matchesNoteFilters(node, filters)) {
      siblings.push({ ...node, name: fileName, parentPath: parentPath || undefined });
    }
  }

  return sortNoteTree(pruneEmptyFolders(root, filters, options), options);
}

export function sortNoteTree(nodes: NoteTreeNode[], options: NoteTreeOptions): NoteTreeNode[] {
  const sorted = [...nodes];
  if (options.alphabetical || options.foldersFirst) {
    sorted.sort((left, right) => {
      const typeRank = options.foldersFirst ? Number(left.type === "note") - Number(right.type === "note") : 0;
      return typeRank || (options.alphabetical ? left.name.localeCompare(right.name) : 0);
    });
  }
  return sorted.map((node) => node.children ? { ...node, children: sortNoteTree(node.children, options) } : node);
}

export function extractNoteFacets(notes: NoteEntry[]): NoteTreeFacets {
  const facets = {
    extensions: new Set<string>(),
    kinds: new Set<NoteKind>(),
    statuses: new Set<NoteStatus>(),
    tags: new Set<string>()
  };

  for (const note of notes) {
    const meta = noteMetadata(note);
    facets.extensions.add(extensionOf(noteTreePath(note)));
    facets.kinds.add(meta.kind ?? "unknown");
    facets.statuses.add(meta.status ?? "unknown");
    for (const tag of meta.tags ?? []) facets.tags.add(tag);
  }

  return {
    extensions: [...facets.extensions].filter(Boolean).sort(),
    kinds: [...facets.kinds].sort(),
    statuses: [...facets.statuses].sort(),
    tags: [...facets.tags].sort()
  };
}

export function noteTreePath(note: NoteEntry): string {
  return note.sourcePath || `${note.categoryName || "Uncategorized"}/${note.title}`;
}

export function isArchivePath(path: string): boolean {
  return path.split(/[\\/]+/g).some((segment) => segment.toLowerCase() === "99-archive" || segment.toLowerCase() === "archive");
}

export function matchesNoteFilters(node: NoteTreeNode, filters: NoteTreeFilters): boolean {
  const extension = node.extension ?? "";
  const meta = node.meta ?? {};
  const tags = meta.tags ?? [];
  const query = filters.query.trim().toLowerCase();

  if (archiveHidden(node, filters)) return false;
  if (filters.extensions.length && !filters.extensions.includes(extension)) return false;
  if (filters.kinds.length && !filters.kinds.includes(meta.kind ?? "unknown")) return false;
  if (filters.statuses.length && !filters.statuses.includes(meta.status ?? "unknown")) return false;
  if (filters.tags.length) {
    const normalized = new Set(tags.map((tag) => tag.toLowerCase()));
    const wanted = filters.tags.map((tag) => tag.toLowerCase());
    const ok = filters.tagMode === "and" ? wanted.every((tag) => normalized.has(tag)) : wanted.some((tag) => normalized.has(tag));
    if (!ok) return false;
  }
  if (!query) return true;

  return [
    node.name,
    node.path,
    node.note?.title,
    node.note?.categoryName,
    meta.title,
    meta.kind,
    meta.status,
    meta.summary,
    ...(meta.tags ?? [])
  ].filter(Boolean).join(" ").toLowerCase().includes(query);
}

function archiveHidden(node: NoteTreeNode, filters: NoteTreeFilters): boolean {
  const meta = node.meta ?? {};
  return !filters.includeArchive && (isArchivePath(node.path) || meta.kind === "archive" || meta.status === "archived" || meta.status === "archive");
}

export function noteMetadata(note: NoteEntry): NonNullable<NoteTreeNode["meta"]> {
  if (note.meta) {
    const path = noteTreePath(note);
    return {
      title: note.meta.title || note.title,
      kind: validKind(note.meta.kind || note.meta.sourceType) ?? inferKind(path, note.categoryName),
      status: validStatus(note.meta.status) ?? inferStatus(path),
      tags: [...new Set(note.meta.tags ?? [])].sort(),
      sourceType: note.meta.sourceType,
      summary: note.meta.summary || note.meta.description
    };
  }

  const frontmatter = parseFrontmatter(note.body);
  const path = noteTreePath(note);
  const kind = validKind(frontmatter.kind || frontmatter.type || frontmatter.sourceType) ?? inferKind(path, note.categoryName);
  const status = validStatus(frontmatter.status || frontmatter.kra) ?? inferStatus(path);
  const tags = parseTags(frontmatter.tags);

  return {
    title: frontmatter.title || note.title,
    kind,
    status,
    tags,
    sourceType: frontmatter.sourceType,
    summary: frontmatter.summary || frontmatter.description
  };
}

function noteNode(note: NoteEntry, path: string, meta: NonNullable<NoteTreeNode["meta"]>): NoteTreeNode {
  return {
    id: `note:${note.id}`,
    name: path.split(/[\\/]+/g).pop() || note.title,
    path,
    type: "note",
    extension: extensionOf(path),
    depth: path.split(/[\\/]+/g).length - 1,
    note,
    meta
  };
}

function pruneEmptyFolders(nodes: NoteTreeNode[], filters: NoteTreeFilters, options: NoteTreeOptions): NoteTreeNode[] {
  const filterActive = hasActiveFilters(filters);
  return nodes.flatMap((node) => {
    if (node.type === "note") return [node];
    const children = pruneEmptyFolders(node.children ?? [], filters, options);
    if (children.length || options.showEmptyFolders || !filterActive) return [{ ...node, children }];
    return [];
  });
}

function hasActiveFilters(filters: NoteTreeFilters): boolean {
  return Boolean(filters.query.trim() || filters.extensions.length || filters.kinds.length || filters.statuses.length || filters.tags.length || !filters.includeArchive);
}

function inferKind(path: string, categoryName: string | null): NoteKind {
  const first = path.split(/[\\/]+/g)[0]?.toLowerCase() ?? "";
  if (KIND_BY_FOLDER[first]) return KIND_BY_FOLDER[first];
  const category = (categoryName ?? "").toLowerCase();
  return NOTE_KINDS.find((kind) => kind !== "unknown" && category.includes(kind)) ?? "unknown";
}

function inferStatus(path: string): NoteStatus {
  return path.split(/[\\/]+/g)[0]?.toLowerCase() === "00-inbox" ? "inbox" : "unknown";
}

function parseFrontmatter(body: string): Record<string, string> {
  const match = body.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return {};

  const data: Record<string, string> = {};
  const lines = match[1].split("\n");
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const pair = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!pair) continue;
    const key = pair[1].trim();
    let value = pair[2].trim();
    while (!value && lines[index + 1]?.match(/^\s*-\s+/)) {
      index++;
      value += `${value ? "," : ""}${lines[index].replace(/^\s*-\s+/, "").trim()}`;
    }
    data[key] = stripQuotes(value);
  }
  return data;
}

function parseTags(value?: string): string[] {
  if (!value) return [];
  return value
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map((tag) => stripQuotes(tag.trim()))
    .filter(Boolean)
    .sort();
}

function validKind(value?: string): NoteKind | null {
  const normalized = value?.trim().toLowerCase();
  return NOTE_KINDS.includes(normalized as NoteKind) ? normalized as NoteKind : null;
}

function validStatus(value?: string): NoteStatus | null {
  const normalized = value?.trim().toLowerCase();
  return NOTE_STATUSES.includes(normalized as NoteStatus) ? normalized as NoteStatus : null;
}

function extensionOf(path: string): string {
  const match = path.match(/(\.[^.\\/]+)$/);
  return match?.[1]?.toLowerCase() ?? "";
}

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, "").trim();
}
