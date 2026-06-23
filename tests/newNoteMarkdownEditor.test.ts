import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const appShell = readFileSync("src/components/useAppShell.ts", "utf8");
const appTemplate = readFileSync("src/components/AppShell.template.html", "utf8");
const styles = readFileSync("src/style.css", "utf8");

test("new note form wires markdown-text-editor to the body textarea", () => {
  assert.match(appShell, /MarkdownEditor from\s*"markdown-text-editor"/);
  assert.match(appTemplate, /ref="noteBodyTextarea"/);
  assert.match(appShell, /new MarkdownEditor\(noteBodyTextarea\.value/);
});

test("edit note form also wires markdown-text-editor to the body textarea", () => {
  assert.match(appShell, /function startEditNote\([^)]*\)[\s\S]*nextTick\(initNoteMarkdownEditor\)/);
  assert.match(appTemplate, /<textarea ref="noteBodyTextarea" v-model="noteEditForm\.body"/);
  assert.match(appShell, /function cancelEditNote\(\)[\s\S]*destroyNoteMarkdownEditor\(\)/);
});

test("note forms expose a header normalize tool after markdown lint", () => {
  assert.match(appShell, /async function normalizeNoteHeaders\([^)]*\)/);
  assert.match(appShell, /fetch\("\/api\/notes\/markdown\/normalize-headers"/);
  assert.match(appTemplate, /@click="normalizeNoteHeaders\(noteForm\)"/);
  assert.match(appTemplate, /@click="normalizeNoteHeaders\(noteEditForm\)"/);
});

test("note metadata forms stay compact above the markdown editor", () => {
  assert.match(appTemplate, /class="grid gap-2 md:grid-cols-5"/);
  assert.match(appTemplate, /input input-bordered input-sm/);
  assert.match(appTemplate, /select select-bordered select-sm/);
  assert.match(appTemplate, /textarea textarea-bordered min-h-16/);
  assert.match(appTemplate, /class="join justify-self-end"/);
  assert.match(appTemplate, /aria-label="Normalize note headers"/);
});

test("note forms expose a topic field", () => {
  assert.match(appTemplate, /v-model="noteForm\.topic"/);
  assert.match(appTemplate, /v-model="noteEditForm\.topic"/);
});

test("markdown editor preview uses app theme background and text colors", () => {
  assert.match(styles, /\.markdown-editor-wrapper\s*\{/);
  assert.match(styles, /--color-base:\s*var\(--color-base-100\)/);
  assert.match(styles, /--color-on-base:\s*var\(--color-base-content\)/);
  assert.match(styles, /\.markdown-editor-wrapper \.preview-wrapper/);
  assert.match(styles, /background:\s*var\(--color-base-100\)/);
});

test("markdown previews style thematic breaks", () => {
  assert.match(styles, /\.markdown-preview hr/);
  assert.match(styles, /\.markdown-editor-wrapper \.preview-content hr/);
  assert.match(styles, /border-top:\s*1px solid var\(--color-base-300\)/);
});
