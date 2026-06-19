import assert from "node:assert/strict";
import test from "node:test";
import { matchesLinkSearch, splitSearchTerms } from "../src/modules/linklist/search";

const link = {
  id: 1,
  title: "Markdown Cheatsheet",
  description: "A collection of Markdown syntax.",
  url: "https://example.com",
  tags: ["Markdown", "Syntax"]
};

test("splitSearchTerms accepts spaces and commas", () => {
  assert.deepEqual(splitSearchTerms(" markdown, syntax  "), ["markdown", "syntax"]);
});

test("matchesLinkSearch requires every term to match title, description, or tags", () => {
  assert.equal(matchesLinkSearch(link, "markdown syntax"), true);
  assert.equal(matchesLinkSearch(link, "markdown react"), false);
  assert.equal(matchesLinkSearch(link, ""), true);
});
