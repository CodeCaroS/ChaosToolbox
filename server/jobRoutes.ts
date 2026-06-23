type JsonResponse = {
  json(value: unknown): void;
  status(code: number): { json(value: unknown): void };
};

type JobQueueLike = {
  listJobs(): unknown[];
  getJob(id: number): unknown | null;
  retry(id: number): unknown | null;
};

type AppLike = {
  get(path: string, handler: (req: { params: Record<string, string> }, res: JsonResponse) => void): void;
  post(path: string, handler: (req: { params: Record<string, string> }, res: JsonResponse) => void): void;
};

export function registerJobRoutes(app: AppLike, jobs: JobQueueLike) {
  app.get("/api/jobs", (_req, res) => {
    res.json(jobs.listJobs());
  });
  app.get("/api/jobs/:id", (req, res) => {
    const job = jobs.getJob(Number(req.params.id));
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    res.json(job);
  });
  app.post("/api/jobs/:id/retry", (req, res) => {
    const job = jobs.retry(Number(req.params.id));
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    res.status(202).json(job);
  });
}
