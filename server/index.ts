import cors from "cors";
import express from "express";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLinkStore } from "./linkStore";
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

app.post("/api/links", (req, res) => {
  const link = parseLink(req.body);
  if (!link) {
    res.status(400).json({ error: "title and valid url are required" });
    return;
  }

  res.status(201).json(store.addLink(link));
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
