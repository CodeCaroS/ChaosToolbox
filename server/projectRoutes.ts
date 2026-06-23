import type { Express } from "express";

type ProjectRoutesDeps = {
  listNotes: () => Array<{ id: number; title: string; meta?: { kind?: string | null } | null }>;
};

export function registerProjectRoutes(app: Express, deps: ProjectRoutesDeps) {
  app.get("/api/projects", (_req, res) => {
    res.json(deps.listNotes().filter((note) => note.meta?.kind === "project"));
  });
}
