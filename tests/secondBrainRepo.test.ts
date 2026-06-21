import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { ensureSecondBrainRepo } from "../server/secondBrainRepo";

test("second brain repo is cloned when missing", () => {
  const root = mkdtempSync(join(tmpdir(), "chaostoolbox-"));
  const target = join(root, "second-brain");
  const calls: string[][] = [];

  const result = ensureSecondBrainRepo("https://example.com/repo.git", target, (...args) => {
    calls.push(args);
    mkdirSync(target);
  });

  assert.equal(result, "cloned");
  assert.deepEqual(calls, [["clone", "https://example.com/repo.git", target]]);
  assert.equal(existsSync(target), true);
});

test("second brain repo is left alone when present", () => {
  const root = mkdtempSync(join(tmpdir(), "chaostoolbox-"));
  const target = join(root, "second-brain");
  mkdirSync(target);
  const calls: string[][] = [];

  const result = ensureSecondBrainRepo("https://example.com/repo.git", target, (...args) => {
    calls.push(args);
  });

  assert.equal(result, "exists");
  assert.deepEqual(calls, []);
});
