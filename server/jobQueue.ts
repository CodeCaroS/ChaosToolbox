export type JobStatus = "queued" | "running" | "succeeded" | "failed";
export type JobKind = "workflow" | "ai" | "rss" | "git";

export type Job = {
  id: number;
  kind: JobKind;
  title: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  input?: unknown;
  logs: string[];
  result?: unknown;
  error?: string;
};

type Work = () => Promise<unknown>;

export function createJobQueue() {
  let nextId = 1;
  let tail = Promise.resolve();
  const jobs = new Map<number, Job>();
  const workByJobId = new Map<number, Work>();
  const pending: Promise<unknown>[] = [];

  function enqueue(kind: JobKind, title: string, work: Work, input?: unknown): Job {
    const now = new Date().toISOString();
    const job: Job = { id: nextId++, kind, title, status: "queued", createdAt: now, updatedAt: now, input, logs: [`${now} queued`] };
    jobs.set(job.id, job);
    workByJobId.set(job.id, work);
    const run = tail.then(async () => {
      update(job, { status: "running", logs: [...job.logs, `${new Date().toISOString()} running`] });
      try {
        update(job, { status: "succeeded", result: await work(), error: undefined, logs: [...job.logs, `${new Date().toISOString()} succeeded`] });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        update(job, { status: "failed", error: message, logs: [...job.logs, `${new Date().toISOString()} failed: ${message}`] });
      }
    });
    tail = run.catch(() => undefined);
    pending.push(run);
    return { ...job };
  }

  function retry(id: number): Job | null {
    const job = jobs.get(id);
    const work = workByJobId.get(id);
    if (!job || !work) return null;
    return enqueue(job.kind, job.title, work, job.input);
  }

  function update(job: Job, patch: Partial<Job>) {
    Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  }

  return {
    enqueue,
    getJob(id: number) {
      const job = jobs.get(id);
      return job ? { ...job } : null;
    },
    listJobs() {
      return Array.from(jobs.values()).slice(-50).reverse().map((job) => ({ ...job }));
    },
    retry,
    async drain() {
      await Promise.allSettled(pending);
    }
  };
}
