import type { Express } from "express";

import type { ArtifactRow, ReviewQueueRow } from "./artifactCore";

type ReviewRoutesDeps = {
  listReviewQueue: () => ReviewQueueRow[];
  updateReviewStatus: (entityType: string, entityId: number, status: string) => ArtifactRow | Promise<ArtifactRow | null> | null;
};

export function registerReviewRoutes(app: Express, deps: ReviewRoutesDeps) {
  app.get("/api/review/queue", (_req, res) => {
    res.json(deps.listReviewQueue());
  });

  app.patch("/api/review/items/:entityType/:entityId", async (req, res) => {
    const entityType = req.params.entityType;
    const entityId = Number(req.params.entityId);
    const status = typeof req.body?.status === "string" ? req.body.status.trim() : "";

    if (!entityType || !Number.isInteger(entityId) || entityId < 1 || !status) {
      res.status(400).json({ error: "entity type, id and status are required" });
      return;
    }

    const updated = await deps.updateReviewStatus(entityType, entityId, status);
    if (!updated) {
      res.status(404).json({ error: "artifact not found" });
      return;
    }

    res.json(updated);
  });
}
