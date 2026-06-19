import assert from "node:assert/strict";
import test from "node:test";
import { isBlockedPreviewUrl, parseLinkPreviewHtml } from "../server/linkPreview";

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
    tags: ["Vue", "SQLite", "links"]
  });
});

test("isBlockedPreviewUrl blocks local targets", () => {
  assert.equal(isBlockedPreviewUrl("http://127.0.0.1:4174"), true);
  assert.equal(isBlockedPreviewUrl("file:///etc/passwd"), true);
  assert.equal(isBlockedPreviewUrl("https://example.com"), false);
});
