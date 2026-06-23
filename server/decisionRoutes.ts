import type { Express } from "express";

type DecisionRoutesDeps = {
  listNotes: () => Array<{ id: number; title: string; meta?: { kind?: string | null } | null }>;
};

export function registerDecisionRoutes(app: Express, deps: DecisionRoutesDeps) {
  app.get("/api/decisions", (_req, res) => {
    res.json(deps.listNotes().filter((note) => note.meta?.kind === "decision"));
  });
}
