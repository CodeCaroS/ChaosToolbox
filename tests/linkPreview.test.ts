import assert from "node:assert/strict";
import test from "node:test";
import { extractArticleText, isBlockedPreviewUrl, parseLinkPreviewHtml } from "../server/linkPreview";

test("parseLinkPreviewHtml prefers Open Graph fields and keywords", () => {
  const preview = parseLinkPreviewHtml(
    "https://example.com",
    `
      <html>
        <head>
          <title>Plain title</title>
          <meta property="og:title" content="Open Graph title">
          <meta name="description" content="Plain description">
          <meta property="og:description" content="Open Graph description">
          <meta name="keywords" content="Vue, SQLite, links">
        </head>
      </html>
    `
  );

  assert.deepEqual(preview, {
    title: "Open Graph title",
    description: "Open Graph description",
    url: "https://example.com",
    categoryId: null,
    tags: ["Vue", "SQLite", "links"]
  });
});

test("isBlockedPreviewUrl blocks local targets", () => {
  assert.equal(isBlockedPreviewUrl("http://127.0.0.1:4174"), true);
  assert.equal(isBlockedPreviewUrl("file:///etc/passwd"), true);
  assert.equal(isBlockedPreviewUrl("https://example.com"), false);
});

test("extractArticleText prefers article body text", () => {
  assert.equal(
    extractArticleText(`
      <html>
        <body>
          <nav>Navigation Home Search</nav>
          <article>
            <h1>Cloud headline</h1>
            <p>First paragraph with useful article content.</p>
            <script>ignored()</script>
            <p>Second paragraph keeps the reading text.</p>
          </article>
          <footer>Footer links</footer>
        </body>
      </html>
    `),
    "Cloud headline\n\nFirst paragraph with useful article content.\n\nSecond paragraph keeps the reading text."
  );
});
