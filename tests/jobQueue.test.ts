import assert from "node:assert/strict";
import test from "node:test";
import { createJobQueue } from "../server/jobQueue";

test("job queue runs async work and stores results", async () => {
  const queue = createJobQueue();
  const job = queue.enqueue("ai", "Create note", async () => ({ noteId: 7 }));

  assert.equal(job.status, "queued");
  assert.equal(queue.listJobs()[0]?.id, job.id);

  await queue.drain();

  assert.equal(queue.getJob(job.id)?.status, "succeeded");
  assert.deepEqual(queue.getJob(job.id)?.result, { noteId: 7 });
});

test("job queue stores failures without stopping later jobs", async () => {
  const queue = createJobQueue();
  const failed = queue.enqueue("workflow", "Fail", async () => {
    throw new Error("broken");
  });
  const next = queue.enqueue("workflow", "Next", async () => "ok");

  await queue.drain();

  assert.equal(queue.getJob(failed.id)?.status, "failed");
  assert.equal(queue.getJob(failed.id)?.error, "broken");
  assert.equal(queue.getJob(next.id)?.status, "succeeded");
  assert.equal(queue.getJob(next.id)?.result, "ok");
});
