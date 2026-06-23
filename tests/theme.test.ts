import assert from "node:assert/strict";
import { test } from "node:test";
import { applyTheme, nextTheme } from "../src/theme";

test("nextTheme toggles between light and dark", () => {
  assert.equal(nextTheme("claude"), "claude-dark");
  assert.equal(nextTheme("claude-dark"), "claude");
});

test("applyTheme stores theme on the document root", () => {
  const root = { dataset: {} as Record<string, string> };

  applyTheme(root as HTMLElement, "claude-dark");

  assert.equal(root.dataset.theme, "claude-dark");
});
