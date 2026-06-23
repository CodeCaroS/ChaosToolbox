import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const appShell = readFileSync("src/components/useAppShell.ts", "utf8");
const appTemplate = readFileSync("src/components/AppShell.template.html", "utf8");

test("source links use a list and detail layout", () => {
  assert.match(appShell, /selectedSourceLinkId/);
  assert.match(appShell, /selectedSourceLink/);
  assert.match(appTemplate, /source-link-list/);
  assert.match(appTemplate, /source-link-detail/);
});

test("source link detail supports editing and scraped tag suggestions", () => {
  assert.match(appShell, /editingSourceLinkId/);
  assert.match(appShell, /sourceEditForm/);
  assert.match(appShell, /suggestSourceTags/);
  assert.match(appShell, /\/api\/links\/preview/);
});
