import { spawnSync } from "node:child_process";

export type GitCommandResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number;
};

export type GitRunner = (repo: string, args: string[]) => GitCommandResult;

export type GitRemote = {
  name: string;
  url: string;
};

export type SecondBrainGitStatus = {
  branch: string;
  ahead: number;
  behind: number;
  changed: boolean;
  conflicts: boolean;
  conflictFiles: string[];
  files: string[];
  remotes: GitRemote[];
  authRequired: boolean;
  message: string;
};

export type SecondBrainGitActionResult = {
  authRequired: boolean;
  conflicts: boolean;
  message: string;
};

export type SecondBrainCommitResult = SecondBrainGitActionResult & {
  committed: boolean;
};

export type SecondBrainPullResult = SecondBrainGitActionResult & {
  pulled: boolean;
};

export function getSecondBrainGitStatus(repo: string, runGit: GitRunner = runGitCommand): SecondBrainGitStatus {
  const result = runGit(repo, ["status", "--porcelain=v1", "--branch"]);
  const remotes = runGit(repo, ["remote", "-v"]);
  const message = output(result);
  const lines = result.stdout.split(/\r?\n/).filter(Boolean);
  const head = lines[0] ?? "";
  const rawFiles = lines.slice(1);
  const files = rawFiles.map((file) => file.trim());
  const conflictFiles = files.filter((file) => /^(UU|AA|DD|DU|UD|UA|AU)\s/.test(file));

  return {
    branch: parseBranch(head),
    ahead: parseCount(head, "ahead"),
    behind: parseCount(head, "behind"),
    changed: files.length > 0,
    conflicts: hasConflict(message) || conflictFiles.length > 0,
    conflictFiles,
    files,
    remotes: parseRemotes(remotes.stdout),
    authRequired: needsAuth(message),
    message: result.ok ? "" : message
  };
}

export function commitSecondBrainRepo(repo: string, message: string, runGit: GitRunner = runGitCommand): SecondBrainCommitResult {
  const commitMessage = message.trim() || "Sync Second Brain";
  const add = runGit(repo, ["add", "-A"]);
  if (!add.ok) return actionResult(add, { committed: false });

  const diff = runGit(repo, ["diff", "--cached", "--quiet"]);
  if (diff.ok) {
    return { committed: false, authRequired: false, conflicts: false, message: "Nothing to commit" };
  }

  const commit = runGit(repo, ["commit", "-m", commitMessage]);
  return actionResult(commit, { committed: commit.ok });
}

export function pushSecondBrainRepo(repo: string, force: boolean, remote = "", branch = "", runGit: GitRunner = runGitCommand): SecondBrainGitActionResult {
  const target = remote && branch ? [remote, branch] : [];
  const result = runGit(repo, force ? ["push", "--force-with-lease", ...target] : ["push", ...target]);
  return actionResult(result);
}

export function pullSecondBrainRepo(repo: string, remote = "", branch = "", runGit: GitRunner = runGitCommand): SecondBrainPullResult {
  const target = remote && branch ? [remote, branch] : [];
  const result = runGit(repo, ["pull", "--no-rebase", ...target]);
  return actionResult(result, { pulled: result.ok });
}

function runGitCommand(repo: string, args: string[]): GitCommandResult {
  const result = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    code: result.status ?? 1
  };
}

function actionResult<T extends object>(result: GitCommandResult, extra?: T): SecondBrainGitActionResult & T {
  const message = output(result);
  return {
    authRequired: needsAuth(message),
    conflicts: hasConflict(message),
    message,
    ...(extra ?? {} as T)
  };
}

function output(result: GitCommandResult): string {
  return [result.stdout, result.stderr].map((value) => value.trim()).filter(Boolean).join("\n");
}

function parseBranch(line: string): string {
  return line.replace(/^##\s*/, "").split("...")[0].split(/\s/)[0] || "";
}

function parseCount(line: string, key: "ahead" | "behind"): number {
  const match = line.match(new RegExp(`${key} (\\d+)`));
  return match ? Number(match[1]) : 0;
}

function parseRemotes(value: string): GitRemote[] {
  const remotes = new Map<string, { fetch?: string; push?: string }>();
  for (const line of value.split(/\r?\n/)) {
    const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
    if (!match) continue;
    const remote = remotes.get(match[1]) ?? {};
    if (match[3] === "push") {
      remote.push = match[2];
    } else {
      remote.fetch = match[2];
    }
    remotes.set(match[1], remote);
  }
  return [...remotes].map(([name, urls]) => ({
    name,
    url: urls.push ?? urls.fetch ?? ""
  }));
}

function needsAuth(message: string): boolean {
  return /authentication failed|could not read (username|password)|permission denied|repository not found|invalid username or token|password authentication is not supported|terminal prompts disabled/i.test(message);
}

function hasConflict(message: string): boolean {
  return /conflict|automatic merge failed|unmerged/i.test(message);
}
