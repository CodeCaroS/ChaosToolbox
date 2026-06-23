import assert from "node:assert/strict";
import test from "node:test";
import { renderMarkdownPreview } from "../src/modules/notes/markdownPreview";

test("markdown preview renders code quotes tables and mermaid blocks", () => {
  const html = renderMarkdownPreview([
    "> Keep this",
    "",
    "| Name | Value |",
    "| --- | --- |",
    "| A | `one` |",
    "",
    "```ts",
    "const x = 1;",
    "```",
    "",
    "```mermaid",
    "graph TD",
    "A-->B",
    "```"
  ].join("\n"));

  assert.match(html, /<blockquote><p>Keep this<\/p><\/blockquote>/);
  assert.match(html, /<table>/);
  assert.match(html, /<th>Name<\/th>/);
  assert.match(html, /<code class="language-ts">const x = 1;<\/code>/);
  assert.match(html, /<pre class="mermaid">graph TD\nA--&gt;B<\/pre>/);
});

test("markdown preview renders thematic breaks", () => {
  assert.equal(renderMarkdownPreview("Intro\n\n---\n\nOutro"), "<p>Intro</p><hr><p>Outro</p>");
});

test("markdown preview renders headings", () => {
  assert.equal(renderMarkdownPreview("#Title\n\n## Subtitle"), "<h1>Title</h1><h2>Subtitle</h2>");
});

test("markdown preview keeps links and doclinks clickable", () => {
  const html = renderMarkdownPreview("[Web](https://example.com) and [Doc](docs/guide.md)");

  assert.match(html, /<a href="https:\/\/example\.com" target="_blank" rel="noreferrer">Web<\/a>/);
  assert.match(html, /<a href="docs\/guide\.md" target="_blank" rel="noreferrer">Doc<\/a>/);
});
