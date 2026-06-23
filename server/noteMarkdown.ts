import { applyFixes } from "markdownlint";
import { lint } from "markdownlint/promise";
import { serializeNoteMarkdown, type NoteFormMetadata } from "../src/modules/notes/frontmatter";

const MARKDOWN_LINT_CONFIG = {
  default: true,
  MD013: false,
  MD024: { siblings_only: true },
  MD025: false,
  MD041: false
};

export type PreparedNoteMarkdown = {
  body: string;
  errors: string[];
};

export async function prepareNoteMarkdown(title: string, body: string, meta?: NoteFormMetadata | null): Promise<PreparedNoteMarkdown> {
  const normalized = await fixMarkdownLint(meta ? serializeNoteMarkdown({ ...meta, title: title.trim() }, body.trim()) : ensureNoteFrontmatter(title.trim(), body.trim()));
  const results = await lintMarkdown(normalized);

  return {
    body: normalized,
    errors: (results.note ?? []).map((error) => `${error.ruleNames[0]} line ${error.lineNumber}: ${error.ruleDescription}`)
  };
}

export async function fixMarkdownLint(markdown: string): Promise<string> {
  let fixed = `${markdown.trimEnd()}\n`;
  for (let index = 0; index < 3; index++) {
    const errors = (await lintMarkdown(fixed)).note ?? [];
    const next = applyFixes(fixed, errors);
    if (next === fixed) return fixed;
    fixed = next;
  }
  return fixed;
}

export async function normalizeMarkdownHeaders(markdown: string): Promise<string> {
  return normalizeHeadingLevels(await fixMarkdownLint(markdown));
}

export function ensureNoteFrontmatter(title: string, body: string): string {
  if (body.startsWith("---\n")) {
    const end = body.indexOf("\n---", 4);
    if (end !== -1 && !body.slice(4, end).split("\n").some((line) => /^title:\s*/.test(line))) {
      return `---\ntitle: ${quoteYaml(title)}\n${body.slice(4)}`;
    }
    return body;
  }

  return `---\ntitle: ${quoteYaml(title)}\nstatus: draft\ntags: []\n---\n\n${body}`;
}

function lintMarkdown(markdown: string) {
  return lint({
    strings: { note: markdown },
    config: MARKDOWN_LINT_CONFIG
  });
}

function normalizeHeadingLevels(markdown: string): string {
  const lines = markdown.split("\n");
  let previousLevel = 0;
  let inFrontmatter = lines[0] === "---";
  let inFence = false;

  return lines.map((line, index) => {
    if (inFrontmatter) {
      if (index > 0 && line === "---") inFrontmatter = false;
      return line;
    }

    if (/^(```|~~~)/.test(line)) {
      inFence = !inFence;
      return line;
    }

    const match = inFence ? null : /^(#{1,6})(\s+.+)$/.exec(line);
    if (!match) return line;

    const level = previousLevel === 0 ? 1 : Math.min(match[1].length, previousLevel + 1);
    previousLevel = level;
    return `${"#".repeat(level)}${match[2]}`;
  }).join("\n");
}

function quoteYaml(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
