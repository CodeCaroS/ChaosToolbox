import cors from "cors";
import express from "express";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLinkStore } from "./linkStore";
import { fetchLinkPreview } from "./linkPreview";
import type { NewLinkEntry } from "../src/modules/linklist/types";
import { createTaskStore } from "./taskStore";
import type { NewTaskEntry } from "../src/modules/tasks/types";
import { createCategoryStore } from "./categoryStore";
import { createNoteStore } from "./noteStore";
import type { NewNoteEntry } from "../src/modules/notes/types";
import { createItemStore } from "./itemStore";
import type { NewItemEntry } from "../src/modules/items/types";
import { createPersonStore } from "./personStore";
import type { NewPersonEntry } from "../src/modules/people/types";
import { createRecipeStore } from "./recipeStore";
import type { NewRecipeEntry } from "../src/modules/recipes/types";
import { createMealPlanStore } from "./mealPlanStore";
import type { NewMealPlanEntry } from "../src/modules/mealplan/types";
import { createLibraryStore } from "./libraryStore";
import type { NewLibraryEntry } from "../src/modules/library/types";
import { createAssetStore } from "./assetStore";
import type { NewAssetEntry } from "../src/modules/assets/types";
import { ensureSecondBrainRepo } from "./secondBrainRepo";
import { syncSecondBrainNotes } from "./secondBrainImport";
import { commitSecondBrainRepo, getSecondBrainGitStatus, pullSecondBrainRepo, pushSecondBrainRepo } from "./secondBrainGit";
import { parseFeedItems } from "./rssParser";
import { createRssStore } from "./rssStore";
import type { NewFeedEntry } from "../src/modules/rss/types";
import { parseOpmlFeeds } from "./opmlParser";
import { refreshEnabledFeeds } from "./rssRefresh";
import { parseEmail } from "./emailParser";
import { createEmailStore } from "./emailStore";
import type { EmailEntry } from "../src/modules/email/types";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = resolve(root, "data", "chaostoolbox.sqlite");
const seedPath = resolve(root, "data", "seed-links.json");
const secondBrainRepoUrl = "https://github.com/CodeCaroS/second-brain.git";
const secondBrainPath = resolve(root, "data", "second-brain");

mkdirSync(dirname(dbPath), { recursive: true });
ensureSecondBrainRepo(secondBrainRepoUrl, secondBrainPath);
syncSecondBrainNotes(dbPath, secondBrainPath);

const seedLinks = JSON.parse(readFileSync(seedPath, "utf8"));
const store = createLinkStore(dbPath, seedLinks);
const taskStore = createTaskStore(dbPath);
const categoryStore = createCategoryStore(dbPath);
const noteStore = createNoteStore(dbPath);
const itemStore = createItemStore(dbPath);
const personStore = createPersonStore(dbPath);
const recipeStore = createRecipeStore(dbPath);
const mealPlanStore = createMealPlanStore(dbPath);
const libraryStore = createLibraryStore(dbPath);
const assetStore = createAssetStore(dbPath);
const rssStore = createRssStore(dbPath);
const emailStore = createEmailStore(dbPath);
const app = express();

refreshEnabledFeeds(rssStore).catch((error) => {
  console.warn("RSS refresh failed", error);
});

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

app.get("/api/rss/feeds", (_req, res) => {
  res.json(rssStore.listFeeds());
});

app.post("/api/rss/feeds", (req, res) => {
  const feed = parseFeed(req.body);
  if (!feed) {
    res.status(400).json({ error: "title and valid feed url are required" });
    return;
  }

  try {
    res.status(201).json(rssStore.addFeed(feed));
  } catch {
    res.status(409).json({ error: "feed already exists" });
  }
});

app.post("/api/rss/opml", (req, res) => {
  if (typeof req.body?.opml !== "string") {
    res.status(400).json({ error: "opml is required" });
    return;
  }

  let created = 0;
  let skipped = 0;
  for (const feed of parseOpmlFeeds(req.body.opml)) {
    try {
      rssStore.addFeed(feed);
      created += 1;
    } catch {
      skipped += 1;
    }
  }

  res.json({ created, skipped });
});

app.patch("/api/rss/feeds/:id/enabled", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1 || typeof req.body?.enabled !== "boolean") {
    res.status(400).json({ error: "id and enabled are required" });
    return;
  }

  if (!rssStore.setFeedEnabled(id, req.body.enabled)) {
    res.status(404).json({ error: "feed not found" });
    return;
  }

  res.json(rssStore.listFeeds().find((feed) => feed.id === id));
});

app.delete("/api/rss/feeds/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "valid id is required" });
    return;
  }

  if (!rssStore.deleteFeed(id)) {
    res.status(404).json({ error: "feed not found" });
    return;
  }

  res.status(204).end();
});

app.get("/api/rss/items", (_req, res) => {
  res.json(rssStore.listFeedItems());
});

app.post("/api/rss/refresh", async (_req, res) => {
  res.json(await refreshEnabledFeeds(rssStore));
});

app.post("/api/rss/feeds/:id/fetch", async (req, res) => {
  const id = Number(req.params.id);
  const feed = rssStore.listFeeds().find((current) => current.id === id);
  if (!Number.isInteger(id) || id < 1 || !feed) {
    res.status(404).json({ error: "feed not found" });
    return;
  }

  try {
    const response = await fetch(feed.url);
    if (!response.ok) {
      res.status(400).json({ error: "feed fetch failed" });
      return;
    }

    res.json(rssStore.upsertFeedItems(feed.id, parseFeedItems(await response.text())));
  } catch {
    res.status(400).json({ error: "feed fetch failed" });
  }
});

app.post("/api/rss/items/save", (req, res) => {
  const item = parseFeedItemSave(req.body);
  if (!item) {
    res.status(400).json({ error: "feedId, title and valid url are required" });
    return;
  }

  const link = store.addLink({
    title: item.title,
    description: `RSS: ${item.feedTitle}`,
    url: item.url,
    categoryId: null,
    tags: ["status:inbox", "rss"]
  });
  rssStore.markFeedItem(item.feedId, item.url, "saved");
  res.status(201).json(link);
});

app.post("/api/rss/items/ignore", (req, res) => {
  const item = parseFeedItemSave(req.body);
  if (!item) {
    res.status(400).json({ error: "feedId, title and valid url are required" });
    return;
  }

  rssStore.markFeedItem(item.feedId, item.url, "ignored");
  res.status(204).end();
});

app.post("/api/rss/items/note", (req, res) => {
  const item = parseFeedItemSave(req.body);
  if (!item) {
    res.status(400).json({ error: "feedId, title and valid url are required" });
    return;
  }

  const note = noteStore.addNote({
    title: item.title,
    body: `Source: ${item.url}\nFeed: ${item.feedTitle}`,
    categoryId: null
  });
  rssStore.markFeedItem(item.feedId, item.url, "saved");
  res.status(201).json(note);
});

app.post("/api/rss/items/task", (req, res) => {
  const item = parseFeedItemSave(req.body);
  if (!item) {
    res.status(400).json({ error: "feedId, title and valid url are required" });
    return;
  }

  const task = taskStore.addTask({
    title: item.title,
    notes: `${item.url}\nRSS: ${item.feedTitle}`,
    priority: 0,
    dueDate: null,
    repeat: "",
    categoryId: null,
    tags: ["rss"],
    steps: []
  });
  rssStore.markFeedItem(item.feedId, item.url, "saved");
  res.status(201).json(task);
});

app.get("/api/email/messages", (_req, res) => {
  res.json(emailStore.listEmails());
});

app.post("/api/email/import", (req, res) => {
  if (typeof req.body?.raw !== "string" || req.body.raw.trim() === "") {
    res.status(400).json({ error: "raw email is required" });
    return;
  }

  const result = emailStore.importEmail(parseEmail(req.body.raw));
  res.status(result.created ? 201 : 200).json(result.email);
});

app.post("/api/email/messages/:id/source", (req, res) => {
  const email = getEmailFromRoute(req.params.id);
  if (!email) {
    res.status(404).json({ error: "email not found" });
    return;
  }

  const link = store.addLink({
    title: email.subject,
    description: `Email: ${email.fromAddress}`,
    url: `mailto:${email.fromAddress}`,
    categoryId: null,
    tags: ["status:inbox", "email"]
  });
  emailStore.markEmail(email.id, "saved");
  res.status(201).json(link);
});

app.post("/api/email/messages/:id/note", (req, res) => {
  const email = getEmailFromRoute(req.params.id);
  if (!email) {
    res.status(404).json({ error: "email not found" });
    return;
  }

  const note = noteStore.addNote({
    title: email.subject,
    body: emailBody(email),
    categoryId: null
  });
  emailStore.markEmail(email.id, "saved");
  res.status(201).json(note);
});

app.post("/api/email/messages/:id/task", (req, res) => {
  const email = getEmailFromRoute(req.params.id);
  if (!email) {
    res.status(404).json({ error: "email not found" });
    return;
  }

  const task = taskStore.addTask({
    title: email.subject,
    notes: emailBody(email),
    priority: 0,
    dueDate: null,
    repeat: "",
    categoryId: null,
    tags: ["email"],
    steps: []
  });
  emailStore.markEmail(email.id, "saved");
  res.status(201).json(task);
});

app.post("/api/email/messages/:id/ignore", (req, res) => {
  const email = getEmailFromRoute(req.params.id);
  if (!email) {
    res.status(404).json({ error: "email not found" });
    return;
  }

  emailStore.markEmail(email.id, "ignored");
  res.status(204).end();
});

app.get("/api/email/messages/:id/attachments/:attachmentId", (req, res) => {
  const email = getEmailFromRoute(req.params.id);
  const attachmentId = Number(req.params.attachmentId);
  const attachment = email?.attachments.find((current) => current.id === attachmentId);
  if (!email || !attachment) {
    res.status(404).json({ error: "attachment not found" });
    return;
  }

  res.type(attachment.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${attachment.filename.replace(/"/g, "")}"`);
  res.send(Buffer.from(attachment.contentBase64, "base64"));
});

app.get("/api/tasks", (_req, res) => {
  res.json(taskStore.listTasks());
});

app.post("/api/tasks", (req, res) => {
  const task = parseTask(req.body);
  if (!task) {
    res.status(400).json({ error: "title is required" });
    return;
  }

  res.status(201).json(taskStore.addTask(task));
});

app.put("/api/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  const task = parseTask(req.body);
  if (!Number.isInteger(id) || id < 1 || !task) {
    res.status(400).json({ error: "id and title are required" });
    return;
  }

  const updated = taskStore.updateTask(id, task);
  if (!updated) {
    res.status(404).json({ error: "task not found" });
    return;
  }

  res.json(updated);
});

app.patch("/api/tasks/:id/toggle", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "valid id is required" });
    return;
  }

  const task = taskStore.toggleTask(id);
  if (!task) {
    res.status(404).json({ error: "task not found" });
    return;
  }

  res.json(task);
});

app.delete("/api/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "valid id is required" });
    return;
  }

  if (!taskStore.deleteTask(id)) {
    res.status(404).json({ error: "task not found" });
    return;
  }

  res.status(204).end();
});

app.get("/api/categories", (_req, res) => {
  res.json(categoryStore.listCategories());
});

app.post("/api/categories", (req, res) => {
  const name = parseCategoryName(req.body);
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  try {
    res.status(201).json(categoryStore.addCategory(name));
  } catch {
    res.status(409).json({ error: "category already exists" });
  }
});

app.put("/api/categories/:id", (req, res) => {
  const id = Number(req.params.id);
  const name = parseCategoryName(req.body);
  if (!Number.isInteger(id) || id < 1 || !name) {
    res.status(400).json({ error: "id and name are required" });
    return;
  }

  try {
    const updated = categoryStore.updateCategory(id, name);
    if (!updated) {
      res.status(404).json({ error: "category not found" });
      return;
    }

    res.json(updated);
  } catch {
    res.status(409).json({ error: "category already exists" });
  }
});

app.delete("/api/categories/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "valid id is required" });
    return;
  }

  if (!categoryStore.deleteCategory(id)) {
    res.status(404).json({ error: "category not found" });
    return;
  }

  res.status(204).end();
});

app.get("/api/notes", (_req, res) => {
  res.json(noteStore.listNotes());
});

app.post("/api/second-brain/import", (_req, res) => {
  res.json(syncSecondBrainNotes(dbPath, secondBrainPath));
});

app.get("/api/second-brain/git/status", (_req, res) => {
  res.json(getSecondBrainGitStatus(secondBrainPath));
});

app.post("/api/second-brain/git/commit", (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message : "";
  const syncResult = syncSecondBrainNotes(dbPath, secondBrainPath);
  const commitResult = commitSecondBrainRepo(secondBrainPath, message);
  res.json({ ...commitResult, sync: syncResult });
});

app.post("/api/second-brain/git/push", (req, res) => {
  const target = parseGitTarget(req.body);
  const syncResult = syncSecondBrainNotes(dbPath, secondBrainPath);
  const pushResult = pushSecondBrainRepo(secondBrainPath, false, target.remote, target.branch);
  res.json({ ...pushResult, sync: syncResult });
});

app.post("/api/second-brain/git/force-push", (req, res) => {
  if (req.body?.confirm !== true) {
    res.status(400).json({ error: "force push requires confirm=true" });
    return;
  }

  const target = parseGitTarget(req.body);
  const syncResult = syncSecondBrainNotes(dbPath, secondBrainPath);
  const pushResult = pushSecondBrainRepo(secondBrainPath, true, target.remote, target.branch);
  res.json({ ...pushResult, sync: syncResult });
});

app.post("/api/second-brain/git/pull", (req, res) => {
  const target = parseGitTarget(req.body);
  res.json(pullSecondBrainRepo(secondBrainPath, target.remote, target.branch));
});

app.post("/api/notes", (req, res) => {
  const note = parseNote(req.body);
  if (!note) {
    res.status(400).json({ error: "title is required" });
    return;
  }

  res.status(201).json(noteStore.addNote(note));
});

app.put("/api/notes/:id", (req, res) => {
  const id = Number(req.params.id);
  const note = parseNote(req.body);
  if (!Number.isInteger(id) || id < 1 || !note) {
    res.status(400).json({ error: "id and title are required" });
    return;
  }

  const updated = noteStore.updateNote(id, note);
  if (!updated) {
    res.status(404).json({ error: "note not found" });
    return;
  }

  res.json(updated);
});

app.delete("/api/notes/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "valid id is required" });
    return;
  }

  if (!noteStore.deleteNote(id)) {
    res.status(404).json({ error: "note not found" });
    return;
  }

  res.status(204).end();
});

app.get("/api/items", (_req, res) => {
  res.json(itemStore.listItems());
});

app.post("/api/items", (req, res) => {
  const item = parseItem(req.body);
  if (!item) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  res.status(201).json(itemStore.addItem(item));
});

app.put("/api/items/:id", (req, res) => {
  const id = Number(req.params.id);
  const item = parseItem(req.body);
  if (!Number.isInteger(id) || id < 1 || !item) {
    res.status(400).json({ error: "id and name are required" });
    return;
  }

  const updated = itemStore.updateItem(id, item);
  if (!updated) {
    res.status(404).json({ error: "item not found" });
    return;
  }

  res.json(updated);
});

app.delete("/api/items/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "valid id is required" });
    return;
  }

  if (!itemStore.deleteItem(id)) {
    res.status(404).json({ error: "item not found" });
    return;
  }

  res.status(204).end();
});

app.get("/api/people", (_req, res) => {
  res.json(personStore.listPeople());
});

app.post("/api/people", (req, res) => {
  const person = parsePerson(req.body);
  if (!person) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  res.status(201).json(personStore.addPerson(person));
});

app.put("/api/people/:id", (req, res) => {
  const id = Number(req.params.id);
  const person = parsePerson(req.body);
  if (!Number.isInteger(id) || id < 1 || !person) {
    res.status(400).json({ error: "id and name are required" });
    return;
  }

  const updated = personStore.updatePerson(id, person);
  if (!updated) {
    res.status(404).json({ error: "person not found" });
    return;
  }

  res.json(updated);
});

app.delete("/api/people/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "valid id is required" });
    return;
  }

  if (!personStore.deletePerson(id)) {
    res.status(404).json({ error: "person not found" });
    return;
  }

  res.status(204).end();
});

app.get("/api/recipes", (_req, res) => {
  res.json(recipeStore.listRecipes());
});

app.post("/api/recipes", (req, res) => {
  const recipe = parseRecipe(req.body);
  if (!recipe) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  res.status(201).json(recipeStore.addRecipe(recipe));
});

app.put("/api/recipes/:id", (req, res) => {
  const id = Number(req.params.id);
  const recipe = parseRecipe(req.body);
  if (!Number.isInteger(id) || id < 1 || !recipe) {
    res.status(400).json({ error: "id and name are required" });
    return;
  }

  const updated = recipeStore.updateRecipe(id, recipe);
  if (!updated) {
    res.status(404).json({ error: "recipe not found" });
    return;
  }

  res.json(updated);
});

app.delete("/api/recipes/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "valid id is required" });
    return;
  }

  if (!recipeStore.deleteRecipe(id)) {
    res.status(404).json({ error: "recipe not found" });
    return;
  }

  res.status(204).end();
});

app.get("/api/meal-plan", (_req, res) => {
  res.json(mealPlanStore.listMealPlan());
});

app.post("/api/meal-plan", (req, res) => {
  const entry = parseMealPlanEntry(req.body);
  if (!entry) {
    res.status(400).json({ error: "day and meal are required" });
    return;
  }

  res.status(201).json(mealPlanStore.addMealPlanEntry(entry));
});

app.put("/api/meal-plan/:id", (req, res) => {
  const id = Number(req.params.id);
  const entry = parseMealPlanEntry(req.body);
  if (!Number.isInteger(id) || id < 1 || !entry) {
    res.status(400).json({ error: "id, day and meal are required" });
    return;
  }

  const updated = mealPlanStore.updateMealPlanEntry(id, entry);
  if (!updated) {
    res.status(404).json({ error: "meal plan entry not found" });
    return;
  }

  res.json(updated);
});

app.delete("/api/meal-plan/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "valid id is required" });
    return;
  }

  if (!mealPlanStore.deleteMealPlanEntry(id)) {
    res.status(404).json({ error: "meal plan entry not found" });
    return;
  }

  res.status(204).end();
});

app.get("/api/library", (_req, res) => {
  res.json(libraryStore.listLibrary());
});

app.post("/api/library", (req, res) => {
  const entry = parseLibraryEntry(req.body);
  if (!entry) {
    res.status(400).json({ error: "title is required" });
    return;
  }

  res.status(201).json(libraryStore.addLibraryEntry(entry));
});

app.put("/api/library/:id", (req, res) => {
  const id = Number(req.params.id);
  const entry = parseLibraryEntry(req.body);
  if (!Number.isInteger(id) || id < 1 || !entry) {
    res.status(400).json({ error: "id and title are required" });
    return;
  }

  const updated = libraryStore.updateLibraryEntry(id, entry);
  if (!updated) {
    res.status(404).json({ error: "library entry not found" });
    return;
  }

  res.json(updated);
});

app.delete("/api/library/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "valid id is required" });
    return;
  }

  if (!libraryStore.deleteLibraryEntry(id)) {
    res.status(404).json({ error: "library entry not found" });
    return;
  }

  res.status(204).end();
});

app.get("/api/assets", (_req, res) => {
  res.json(assetStore.listAssets());
});

app.post("/api/assets", (req, res) => {
  const asset = parseAsset(req.body);
  if (!asset) {
    res.status(400).json({ error: "title and valid image URL are required" });
    return;
  }

  res.status(201).json(assetStore.addAsset(asset));
});

app.put("/api/assets/:id", (req, res) => {
  const id = Number(req.params.id);
  const asset = parseAsset(req.body);
  if (!Number.isInteger(id) || id < 1 || !asset) {
    res.status(400).json({ error: "id, title and valid image URL are required" });
    return;
  }

  const updated = assetStore.updateAsset(id, asset);
  if (!updated) {
    res.status(404).json({ error: "asset not found" });
    return;
  }

  res.json(updated);
});

app.delete("/api/assets/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "valid id is required" });
    return;
  }

  if (!assetStore.deleteAsset(id)) {
    res.status(404).json({ error: "asset not found" });
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
    categoryId: typeof body.categoryId === "number" && Number.isInteger(body.categoryId) ? body.categoryId : null,
    tags: Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === "string") : []
  };
}

function parseFeed(value: unknown): NewFeedEntry | null {
  const body = value as Partial<NewFeedEntry> | null;
  if (!body || typeof body.title !== "string" || typeof body.url !== "string" || body.title.trim() === "") return null;

  try {
    new URL(body.url);
  } catch {
    return null;
  }

  return {
    title: body.title.trim(),
    url: body.url.trim(),
    enabled: body.enabled === false ? false : true
  };
}

function parseFeedItemSave(value: unknown): { feedId: number; feedTitle: string; title: string; url: string } | null {
  const body = value as { feedId?: unknown; feedTitle?: unknown; title?: unknown; url?: unknown } | null;
  if (!body || typeof body.feedId !== "number" || !Number.isInteger(body.feedId) || typeof body.title !== "string" || typeof body.url !== "string") return null;

  try {
    new URL(body.url);
  } catch {
    return null;
  }

  return {
    feedId: body.feedId,
    feedTitle: typeof body.feedTitle === "string" ? body.feedTitle : "",
    title: body.title.trim(),
    url: body.url.trim()
  };
}

function getEmailFromRoute(value: string): EmailEntry | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? emailStore.getEmail(id) : null;
}

function emailBody(email: EmailEntry): string {
  return `From: ${email.fromAddress}\nTo: ${email.toAddress}\nDate: ${email.receivedAt ?? ""}\n\n${email.body}`;
}

function parseTask(value: unknown): NewTaskEntry | null {
  const body = value as Partial<NewTaskEntry> | null;
  if (!body || typeof body.title !== "string" || body.title.trim() === "") return null;
  const repeat = typeof body.repeat === "string" && ["", "weekly", "biweekly", "monthly", "quarterly"].includes(body.repeat) ? body.repeat : "";

  return {
    title: body.title.trim(),
    notes: typeof body.notes === "string" ? body.notes : "",
    priority: typeof body.priority === "number" && Number.isInteger(body.priority) ? body.priority : 0,
    dueDate: typeof body.dueDate === "string" && body.dueDate.trim() ? body.dueDate.trim() : null,
    repeat,
    categoryId: typeof body.categoryId === "number" && Number.isInteger(body.categoryId) ? body.categoryId : null,
    tags: Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === "string") : [],
    steps: Array.isArray(body.steps)
      ? body.steps
        .flatMap((step) => {
          const candidate = step as { text?: unknown; done?: unknown };
          return typeof candidate.text === "string" && candidate.text.trim() ? [{ text: candidate.text.trim(), done: candidate.done === true }] : [];
        })
        .filter((step) => step.text)
      : []
  };
}

function parseCategoryName(value: unknown): string | null {
  const body = value as { name?: unknown } | null;
  return body && typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;
}

function parseNote(value: unknown): NewNoteEntry | null {
  const body = value as Partial<NewNoteEntry> | null;
  if (!body || typeof body.title !== "string" || body.title.trim() === "") return null;

  return {
    title: body.title.trim(),
    body: typeof body.body === "string" ? body.body : "",
    categoryId: typeof body.categoryId === "number" && Number.isInteger(body.categoryId) ? body.categoryId : null
  };
}

function parseGitTarget(value: unknown): { remote: string; branch: string } {
  const body = value as { remote?: unknown; branch?: unknown } | null;
  return {
    remote: typeof body?.remote === "string" ? body.remote.trim() : "",
    branch: typeof body?.branch === "string" ? body.branch.trim() : ""
  };
}

function parseItem(value: unknown): NewItemEntry | null {
  const body = value as Partial<NewItemEntry> | null;
  if (!body || typeof body.name !== "string" || body.name.trim() === "") return null;

  return {
    name: body.name.trim(),
    type: typeof body.type === "string" ? body.type : "",
    quality: typeof body.quality === "string" ? body.quality : "",
    source: typeof body.source === "string" ? body.source : "",
    description: typeof body.description === "string" ? body.description : "",
    url: typeof body.url === "string" ? body.url : ""
  };
}

function parsePerson(value: unknown): NewPersonEntry | null {
  const body = value as Partial<NewPersonEntry> | null;
  if (!body || typeof body.name !== "string" || body.name.trim() === "") return null;

  return {
    name: body.name.trim(),
    role: typeof body.role === "string" ? body.role : "",
    status: typeof body.status === "string" ? body.status : "",
    contact: typeof body.contact === "string" ? body.contact : "",
    notes: typeof body.notes === "string" ? body.notes : ""
  };
}

function parseRecipe(value: unknown): NewRecipeEntry | null {
  const body = value as Partial<NewRecipeEntry> | null;
  if (!body || typeof body.name !== "string" || body.name.trim() === "") return null;

  const rating = typeof body.rating === "number" && Number.isInteger(body.rating) ? body.rating : 0;

  return {
    name: body.name.trim(),
    rating: Math.max(0, Math.min(5, rating)),
    categoryId: typeof body.categoryId === "number" && Number.isInteger(body.categoryId) ? body.categoryId : null,
    notes: typeof body.notes === "string" ? body.notes : "",
    tags: Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === "string") : []
  };
}

function parseMealPlanEntry(value: unknown): NewMealPlanEntry | null {
  const body = value as Partial<NewMealPlanEntry> | null;
  if (!body || typeof body.day !== "string" || body.day.trim() === "" || typeof body.meal !== "string" || body.meal.trim() === "") return null;

  return {
    day: body.day.trim(),
    meal: body.meal.trim(),
    notes: typeof body.notes === "string" ? body.notes : ""
  };
}

function parseLibraryEntry(value: unknown): NewLibraryEntry | null {
  const body = value as Partial<NewLibraryEntry> | null;
  if (!body || typeof body.title !== "string" || body.title.trim() === "") return null;
  const status = body.status === "complete" ? "complete" : "incomplete";

  return {
    title: body.title.trim(),
    author: typeof body.author === "string" ? body.author : "",
    series: typeof body.series === "string" ? body.series : "",
    status,
    url: typeof body.url === "string" ? body.url : "",
    description: typeof body.description === "string" ? body.description : "",
    categoryId: typeof body.categoryId === "number" && Number.isInteger(body.categoryId) ? body.categoryId : null,
    tags: Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === "string") : []
  };
}

function parseAsset(value: unknown): NewAssetEntry | null {
  const body = value as Partial<NewAssetEntry> | null;
  if (!body || typeof body.title !== "string" || body.title.trim() === "" || typeof body.imageUrl !== "string") return null;

  try {
    new URL(body.imageUrl);
  } catch {
    return null;
  }

  return {
    title: body.title.trim(),
    imageUrl: body.imageUrl.trim(),
    gallery: typeof body.gallery === "string" ? body.gallery : "",
    description: typeof body.description === "string" ? body.description : "",
    categoryId: typeof body.categoryId === "number" && Number.isInteger(body.categoryId) ? body.categoryId : null
  };
}

app.listen(4174, "127.0.0.1", () => {
  console.log("API listening on http://127.0.0.1:4174");
});
