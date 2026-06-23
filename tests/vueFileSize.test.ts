import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const CHECKED_EXTENSIONS = new Set([".css", ".html", ".ts", ".vue"]);

function checkedFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    const stats = statSync(path);
    if (stats.isDirectory()) return checkedFiles(path);
    const extension = path.slice(path.lastIndexOf("."));
    return CHECKED_EXTENSIONS.has(extension) ? [path] : [];
  });
}

test("source files stay below 500 lines", () => {
  const oversized = ["src", "server", "tests"].flatMap(checkedFiles)
    .map((path) => ({ path: relative(".", path), lines: readFileSync(path, "utf8").split(/\r?\n/).length }))
    .filter((file) => file.lines > 500);

  assert.deepEqual(oversized, []);
});
