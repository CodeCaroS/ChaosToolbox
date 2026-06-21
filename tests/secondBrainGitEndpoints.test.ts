import assert from "node:assert/strict";
import test from "node:test";
import { createSecondBrainGitEndpointHandlers } from "../server/secondBrainGitEndpoints";
import type { SecondBrainSyncResult } from "../server/secondBrainImport";

test("second brain git endpoints include sync result and conflict propagation on commit", () => {
  const sync: () => SecondBrainSyncResult = () => ({
    created: 0,
    updated: 0,
    unchanged: 0,
    deleted: 0,
    written: 0,
    conflicts: 1
  });
  const commit = () => ({
    committed: true,
    authRequired: false,
    conflicts: false,
    message: "committed"
  });

  const handlers = createSecondBrainGitEndpointHandlers({
    sync: () => sync(),
    commit
  });
  const result = handlers.createCommitPayload("db", "repo", "msg");

  assert.equal(result.conflicts, true);
  assert.equal(result.sync?.conflicts, 1);
  assert.equal(result.committed, true);
  assert.equal(result.message, "committed");
});

test("second brain git endpoints include sync result and conflict propagation on push", () => {
  const sync: () => SecondBrainSyncResult = () => ({
    created: 0,
    updated: 0,
    unchanged: 0,
    deleted: 0,
    written: 0,
    conflicts: 1
  });
  const push = () => ({
    authRequired: false,
    conflicts: false,
    message: "pushed"
  });

  const handlers = createSecondBrainGitEndpointHandlers({
    sync: () => sync(),
    push
  });
  const result = handlers.createPushPayload("db", "repo", "origin", "main");

  assert.equal(result.conflicts, true);
  assert.equal(result.sync?.conflicts, 1);
  assert.equal(result.message, "pushed");
});

test("second brain git endpoints include sync result and conflict propagation on pull", () => {
  const sync: () => SecondBrainSyncResult = () => ({
    created: 0,
    updated: 0,
    unchanged: 0,
    deleted: 0,
    written: 0,
    conflicts: 1
  });
  const pull = () => ({
    pulled: false,
    authRequired: false,
    conflicts: false,
    message: "pull failed"
  });

  const handlers = createSecondBrainGitEndpointHandlers({
    sync: () => sync(),
    pull
  });
  const result = handlers.createPullPayload("db", "repo", "origin", "main");

  assert.equal(result.conflicts, true);
  assert.equal(result.sync?.conflicts, 1);
  assert.equal(result.message, "pull failed");
});
