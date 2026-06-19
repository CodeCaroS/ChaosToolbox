import cors from "cors";
import express from "express";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLinkStore } from "./linkStore";
import { fetchLinkPreview } from "./linkPreview";
import type { NewLinkEntry } from "../src/modules/linklist/types";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = resolve(root, "data", "chaostoolbox.sqlite");
const seedPath = resolve(root, "data", "seed-links.json");

mkdirSync(dirname(dbPath), { recursive: true });

const seedLinks = JSON.parse(readFileSync(seedPath, "utf8"));
const store = createLinkStore(dbPath, seedLinks);
const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/links", (_req, res) => {
  res.json(store.listLinks());
});

app.post("/api/links/preview", async (req, res) => {
  if (!req.body || typeof req.body.url !== "string") {
    res.status(400).json({ error: "valid url is required" });
    return;
  }

  const preview = await fetchLinkPreview(req.body.url).catch(() => null);
  if (!preview) {
    res.status(400).json({ error: "preview unavailable" });
    return;
  }

  res.json(preview);
});

app.post("/api/links", (req, res) => {
  const link = parseLink(req.body);
  if (!link) {
    res.status(400).json({ error: "title and valid url are required" });
    return;
  }

  res.status(201).json(store.addLink(link));
});

app.put("/api/links/:id", (req, res) => {
  const id = Number(req.params.id);
  const link = parseLink(req.body);
  if (!Number.isInteger(id) || id < 1 || !link) {
    res.status(400).json({ error: "id, title and valid url are required" });
    return;
  }

  const updated = store.updateLink(id, link);
  if (!updated) {
    res.status(404).json({ error: "link not found" });
    return;
  }

  res.json(updated);
});

app.delete("/api/links/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "valid id is required" });
    return;
  }

  if (!store.deleteLink(id)) {
    res.status(404).json({ error: "link not found" });
    return;
  }

  res.status(204).end();
});

function parseLink(value: unknown): NewLinkEntry | null {
  const body = value as Partial<NewLinkEntry> | null;
  if (!body || typeof body.title !== "string" || typeof body.url !== "string") return null;

  try {
    new URL(body.url);
  } catch {
    return null;
  }

  return {
    title: body.title.trim(),
    description: typeof body.description === "string" ? body.description : "",
    url: body.url.trim(),
    tags: Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === "string") : []
  };
}

app.listen(4174, "127.0.0.1", () => {
  console.log("API listening on http://127.0.0.1:4174");
});
