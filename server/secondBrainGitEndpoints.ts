import type { SecondBrainCommitResult, SecondBrainPullResult, SecondBrainGitActionResult } from "./secondBrainGit";
import { commitSecondBrainRepo, pullSecondBrainRepo, pushSecondBrainRepo } from "./secondBrainGit";
import type { SecondBrainSyncResult } from "./secondBrainImport";
import { syncSecondBrainNotes } from "./secondBrainImport";

type SyncFn = (dbPath: string, secondBrainPath: string) => SecondBrainSyncResult;
type CommitFn = (repo: string, message: string) => SecondBrainCommitResult;
type PushFn = (repo: string, force: boolean, remote: string, branch: string) => SecondBrainGitActionResult;
type PullFn = (repo: string, remote: string, branch: string) => SecondBrainPullResult;

export type SecondBrainGitEndpointResult = {
  sync: SecondBrainSyncResult;
};

type CommitPayload = SecondBrainCommitResult & SecondBrainGitEndpointResult;
type PushPayload = SecondBrainGitActionResult & SecondBrainGitEndpointResult;
type PullPayload = SecondBrainPullResult & SecondBrainGitEndpointResult;

type Handlers = {
  createCommitPayload: (dbPath: string, secondBrainPath: string, message: string) => CommitPayload;
  createPushPayload: (dbPath: string, secondBrainPath: string, remote: string, branch: string) => PushPayload;
  createForcePushPayload: (dbPath: string, secondBrainPath: string, remote: string, branch: string) => PushPayload;
  createPullPayload: (dbPath: string, secondBrainPath: string, remote: string, branch: string) => PullPayload;
};

export type SecondBrainGitEndpointDeps = {
  sync?: SyncFn;
  commit?: CommitFn;
  push?: PushFn;
  pull?: PullFn;
};

export function createSecondBrainGitEndpointHandlers(deps: SecondBrainGitEndpointDeps = {}): Handlers {
  const sync = deps.sync ?? syncSecondBrainNotes;
  const commit = deps.commit ?? commitSecondBrainRepo;
  const push = deps.push ?? pushSecondBrainRepo;
  const pull = deps.pull ?? pullSecondBrainRepo;

  return {
    createCommitPayload(dbPath: string, secondBrainPath: string, message: string) {
      const syncResult = sync(dbPath, secondBrainPath);
      const commitResult = commit(secondBrainPath, message);
      return { ...commitResult, conflicts: commitResult.conflicts || syncResult.conflicts > 0, sync: syncResult };
    },
    createPushPayload(dbPath: string, secondBrainPath: string, remote: string, branch: string) {
      const syncResult = sync(dbPath, secondBrainPath);
      const pushResult = push(secondBrainPath, false, remote, branch);
      return { ...pushResult, conflicts: pushResult.conflicts || syncResult.conflicts > 0, sync: syncResult };
    },
    createForcePushPayload(dbPath: string, secondBrainPath: string, remote: string, branch: string) {
      const syncResult = sync(dbPath, secondBrainPath);
      const pushResult = push(secondBrainPath, true, remote, branch);
      return { ...pushResult, conflicts: pushResult.conflicts || syncResult.conflicts > 0, sync: syncResult };
    },
    createPullPayload(dbPath: string, secondBrainPath: string, remote: string, branch: string) {
      const pullResult = pull(secondBrainPath, remote, branch);
      const syncResult = sync(dbPath, secondBrainPath);
      return { ...pullResult, conflicts: pullResult.conflicts || syncResult.conflicts > 0, sync: syncResult };
    }
  };
}
