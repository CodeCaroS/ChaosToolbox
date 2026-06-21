import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

export type SecondBrainRepoStatus = "cloned" | "exists";
export type GitRunner = (...args: string[]) => void;

export function ensureSecondBrainRepo(repoUrl: string, targetDir: string, runGit: GitRunner = runGitCommand): SecondBrainRepoStatus {
  if (existsSync(targetDir)) return "exists";

  runGit("clone", repoUrl, targetDir);
  return "cloned";
}

function runGitCommand(...args: string[]) {
  execFileSync("git", args, { stdio: "inherit" });
}
