import assert from "node:assert/strict";
import test from "node:test";
import {
  commitSecondBrainRepo,
  getSecondBrainGitStatus,
  pullSecondBrainRepo,
  pushSecondBrainRepo,
  type GitCommandResult,
  type GitRunner
} from "../server/secondBrainGit";

test("second brain git status parses branch, changes and conflicts", () => {
  const runGit: GitRunner = (_repo, args) => {
    if (args[0] === "remote") {
      return { ok: true, stdout: "origin\thttps://example.com/repo.git (fetch)\norigin\thttps://example.com/repo.git (push)\nbackup\tgit@example.com:repo.git (push)\n", stderr: "", code: 0 };
    }
    assert.deepEqual(args, ["status", "--porcelain=v1", "--branch"]);
    return {
      ok: true,
      stdout: "## main...origin/main [ahead 1, behind 2]\n M README.md\nUU conflict.md\n",
      stderr: "",
      code: 0
    };
  };

  assert.deepEqual(getSecondBrainGitStatus("repo", runGit), {
    branch: "main",
    ahead: 1,
    behind: 2,
    changed: true,
    conflicts: true,
    conflictFiles: ["UU conflict.md"],
    files: ["M README.md", "UU conflict.md"],
    remotes: [
      { name: "origin", url: "https://example.com/repo.git" },
      { name: "backup", url: "git@example.com:repo.git" }
    ],
    authRequired: false,
    message: ""
  });
});

test("second brain git status keeps dots in branch names", () => {
  const runGit: GitRunner = (_repo, args) => {
    if (args[0] === "remote") return { ok: true, stdout: "", stderr: "", code: 0 };
    return {
      ok: true,
      stdout: "## release/v1.2...origin/release/v1.2 [ahead 1]\n",
      stderr: "",
      code: 0
    };
  };

  assert.equal(getSecondBrainGitStatus("repo", runGit).branch, "release/v1.2");
});

test("second brain git status keeps remotes with only fetch URLs", () => {
  const runGit: GitRunner = (_repo, args) => {
    if (args[0] === "remote") {
      return { ok: true, stdout: "origin\thttps://example.com/repo.git (fetch)\n", stderr: "", code: 0 };
    }
    return {
      ok: true,
      stdout: "## main...origin/main [ahead 0, behind 0]\n",
      stderr: "",
      code: 0
    };
  };

  assert.deepEqual(getSecondBrainGitStatus("repo", runGit).remotes, [
    { name: "origin", url: "https://example.com/repo.git" }
  ]);
});

test("second brain git commit stages all files and uses the requested message", () => {
  const calls: string[][] = [];
  const runGit: GitRunner = (_repo, args) => {
    calls.push(args);
    if (args[0] === "diff") return { ok: false, stdout: "", stderr: "", code: 1 };
    return { ok: true, stdout: "ok", stderr: "", code: 0 };
  };

  assert.deepEqual(commitSecondBrainRepo("repo", "Sync notes", runGit), {
    committed: true,
    authRequired: false,
    conflicts: false,
    message: "ok"
  });
  assert.deepEqual(calls, [
    ["add", "-A"],
    ["diff", "--cached", "--quiet"],
    ["commit", "-m", "Sync notes"]
  ]);
});

test("second brain git commit skips when nothing is staged", () => {
  const calls: string[][] = [];
  const runGit: GitRunner = (_repo, args) => {
    calls.push(args);
    return { ok: true, stdout: "", stderr: "", code: 0 };
  };

  assert.deepEqual(commitSecondBrainRepo("repo", "Sync notes", runGit), {
    committed: false,
    authRequired: false,
    conflicts: false,
    message: "Nothing to commit"
  });
  assert.deepEqual(calls, [
    ["add", "-A"],
    ["diff", "--cached", "--quiet"]
  ]);
});

test("second brain git push supports normal and force-with-lease pushes", () => {
  const calls: string[][] = [];
  const runGit: GitRunner = (_repo, args): GitCommandResult => {
    calls.push(args);
    return { ok: true, stdout: "pushed", stderr: "", code: 0 };
  };

  assert.equal(pushSecondBrainRepo("repo", false, "origin", "main", runGit).message, "pushed");
  assert.equal(pushSecondBrainRepo("repo", true, "backup", "main", runGit).message, "pushed");
  assert.deepEqual(calls, [["push", "origin", "main"], ["push", "--force-with-lease", "backup", "main"]]);
});

test("second brain git reports auth and merge conflict failures", () => {
  const authRunner: GitRunner = () => ({ ok: false, stdout: "", stderr: "Authentication failed", code: 128 });
  const conflictRunner: GitRunner = () => ({ ok: false, stdout: "CONFLICT (content): Merge conflict", stderr: "", code: 1 });

  assert.equal(pushSecondBrainRepo("repo", false, "", "", authRunner).authRequired, true);
  assert.deepEqual(pullSecondBrainRepo("repo", "origin", "main", conflictRunner), {
    pulled: false,
    authRequired: false,
    conflicts: true,
    message: "CONFLICT (content): Merge conflict"
  });
});

test("second brain git recognizes common credential prompts as auth failures", () => {
  const messages = [
    "fatal: could not read Password for 'https://github.com': terminal prompts disabled",
    "remote: Invalid username or token. Password authentication is not supported for Git operations.",
    "fatal: Authentication failed for 'https://github.com/example/repo.git/'"
  ];

  for (const message of messages) {
    const runner: GitRunner = () => ({ ok: false, stdout: "", stderr: message, code: 128 });
    assert.equal(pushSecondBrainRepo("repo", false, "origin", "main", runner).authRequired, true);
  }
});

test("second brain git checks stderr even when stdout is present", () => {
  const runner: GitRunner = () => ({
    ok: false,
    stdout: "some progress output",
    stderr: "fatal: could not read Username for 'https://github.com': terminal prompts disabled",
    code: 128
  });

  const result = pushSecondBrainRepo("repo", false, "origin", "main", runner);
  assert.equal(result.authRequired, true);
  assert.match(result.message, /some progress output/);
  assert.match(result.message, /could not read Username/);
});
