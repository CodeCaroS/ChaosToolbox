type AppLike = {
  get(path: string, handler: (req: any, res: any) => void): void;
  post(path: string, handler: (req: any, res: any) => void): void;
};

type Deps = {
  dbPath: string;
  secondBrainPath: string;
  jobs: {
    enqueue(kind: string, title: string, work: () => Promise<unknown> | unknown): { id: number };
  };
  noteStore: {
    addNote(note: { title: string; body: string; categoryId: number | null }): unknown;
  };
  syncSecondBrainNotes: (dbPath: string, secondBrainPath: string) => { conflicts: number } & Record<string, unknown>;
  createTikTokKnowledgeNote: (url: string, secondBrainPath: string) => Promise<Record<string, unknown>>;
  getSecondBrainGitStatus: (secondBrainPath: string) => unknown;
  secondBrainGitEndpoints: {
    createCommitPayload(dbPath: string, secondBrainPath: string, message: string): unknown;
    createPushPayload(dbPath: string, secondBrainPath: string, remote: string, branch: string): unknown;
    createForcePushPayload(dbPath: string, secondBrainPath: string, remote: string, branch: string): unknown;
    createPullPayload(dbPath: string, secondBrainPath: string, remote: string, branch: string): unknown;
  };
};

export function registerSecondBrainRoutes(app: AppLike, deps: Deps) {
  app.post("/api/second-brain/import", (_req, res) => {
    const job = deps.jobs.enqueue("workflow", "Sync Second Brain", () => Promise.resolve(deps.syncSecondBrainNotes(deps.dbPath, deps.secondBrainPath)));
    res.status(202).json({ jobId: job.id, job });
  });
  app.post("/api/second-brain/tiktok-note", (req, res) => {
    if (typeof req.body?.url !== "string") {
      res.status(400).json({ error: "valid TikTok URL is required" });
      return;
    }
    const url = req.body.url;
    const job = deps.jobs.enqueue("ai", "Create TikTok note", async () => {
      const note = await deps.createTikTokKnowledgeNote(url, deps.secondBrainPath);
      return { ...note, sync: deps.syncSecondBrainNotes(deps.dbPath, deps.secondBrainPath) };
    });
    res.status(202).json({ jobId: job.id, job });
  });
  app.get("/api/second-brain/git/status", (_req, res) => {
    res.json(deps.getSecondBrainGitStatus(deps.secondBrainPath));
  });
  app.post("/api/second-brain/git/commit", (req, res) => {
    const message = typeof req.body?.message === "string" ? req.body.message : "";
    const job = deps.jobs.enqueue("git", "Commit Second Brain", () => Promise.resolve(deps.secondBrainGitEndpoints.createCommitPayload(deps.dbPath, deps.secondBrainPath, message)));
    res.status(202).json({ jobId: job.id, job });
  });
  app.post("/api/second-brain/git/push", (req, res) => {
    const target = parseGitTarget(req.body);
    const job = deps.jobs.enqueue("git", "Push Second Brain", () => Promise.resolve(deps.secondBrainGitEndpoints.createPushPayload(deps.dbPath, deps.secondBrainPath, target.remote, target.branch)));
    res.status(202).json({ jobId: job.id, job });
  });
  app.post("/api/second-brain/git/force-push", (req, res) => {
    if (req.body?.confirm !== true) {
      res.status(400).json({ error: "force push requires confirm=true" });
      return;
    }
    const target = parseGitTarget(req.body);
    const job = deps.jobs.enqueue("git", "Force push Second Brain", () => Promise.resolve(deps.secondBrainGitEndpoints.createForcePushPayload(deps.dbPath, deps.secondBrainPath, target.remote, target.branch)));
    res.status(202).json({ jobId: job.id, job });
  });
  app.post("/api/second-brain/git/pull", (req, res) => {
    const target = parseGitTarget(req.body);
    const job = deps.jobs.enqueue("git", "Pull Second Brain", () => Promise.resolve(deps.secondBrainGitEndpoints.createPullPayload(deps.dbPath, deps.secondBrainPath, target.remote, target.branch)));
    res.status(202).json({ jobId: job.id, job });
  });
}

function parseGitTarget(value: any) {
  const body = value;
  return {
    remote: typeof body?.remote === "string" ? body.remote.trim() : "",
    branch: typeof body?.branch === "string" ? body.branch.trim() : ""
  };
}
