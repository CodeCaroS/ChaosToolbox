import Database from "better-sqlite3";
import { deleteArtifactForEntity, ensureArtifactCore, upsertArtifact } from "./artifactCore";
import type { NewTaskEntry, TaskEntry } from "../src/modules/tasks/types";

export function createTaskStore(filename: string) {
  const db = new Database(filename);
  db.pragma("foreign_keys = ON");
  ensureArtifactCore(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      priority INTEGER NOT NULL DEFAULT 0,
      done INTEGER NOT NULL DEFAULT 0,
      due_date TEXT,
      repeat TEXT NOT NULL DEFAULT '',
      category_id INTEGER,
      steps_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE
    );
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE
    );
    CREATE TABLE IF NOT EXISTS task_tags (
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (task_id, tag_id)
    );
  `);
  const columns = db.prepare("PRAGMA table_info(tasks)").all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "due_date")) db.prepare("ALTER TABLE tasks ADD COLUMN due_date TEXT").run();
  if (!columns.some((column) => column.name === "repeat")) db.prepare("ALTER TABLE tasks ADD COLUMN repeat TEXT NOT NULL DEFAULT ''").run();
  if (!columns.some((column) => column.name === "category_id")) db.prepare("ALTER TABLE tasks ADD COLUMN category_id INTEGER").run();
  if (!columns.some((column) => column.name === "steps_json")) db.prepare("ALTER TABLE tasks ADD COLUMN steps_json TEXT NOT NULL DEFAULT '[]'").run();

  function rowToTask(row: unknown): TaskEntry {
    const { stepsJson, ...task } = row as Omit<TaskEntry, "done" | "tags" | "steps"> & { done: number; stepsJson: string };
    return { ...task, done: task.done === 1, tags: getTags(task.id), steps: parseSteps(stepsJson) };
  }

  function parseSteps(value: string): TaskEntry["steps"] {
    try {
      const steps = JSON.parse(value) as Array<{ text?: unknown; done?: unknown }>;
      if (!Array.isArray(steps)) return [];
      return steps.flatMap((step) => typeof step.text === "string" && step.text.trim() ? [{ text: step.text.trim(), done: step.done === true }] : []);
    } catch {
      return [];
    }
  }

  function cleanTags(tags: string[]) {
    return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
  }

  function getTags(taskId: number): string[] {
    return db
      .prepare("SELECT tags.name FROM tags JOIN task_tags ON tags.id = task_tags.tag_id WHERE task_tags.task_id = ? ORDER BY tags.name")
      .all(taskId)
      .map((row) => (row as { name: string }).name);
  }

  function setTags(taskId: number, tags: string[]) {
    db.prepare("DELETE FROM task_tags WHERE task_id = ?").run(taskId);
    const insertTag = db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)");
    const findTag = db.prepare("SELECT id FROM tags WHERE name = ?");
    const connectTag = db.prepare("INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)");

    for (const tag of cleanTags(tags)) {
      insertTag.run(tag);
      connectTag.run(taskId, (findTag.get(tag) as { id: number }).id);
    }
  }

  function listTasks(): TaskEntry[] {
    return db
      .prepare(`
        SELECT tasks.id, tasks.title, tasks.notes, tasks.priority, tasks.done, tasks.due_date AS dueDate, tasks.repeat, tasks.category_id AS categoryId, tasks.steps_json AS stepsJson, categories.name AS categoryName
        FROM tasks
        LEFT JOIN categories ON categories.id = tasks.category_id
        ORDER BY tasks.done, tasks.priority DESC, tasks.id
      `)
      .all()
      .map(rowToTask);
  }

  function getTask(id: number): TaskEntry {
    return rowToTask(db
      .prepare(`
        SELECT tasks.id, tasks.title, tasks.notes, tasks.priority, tasks.done, tasks.due_date AS dueDate, tasks.repeat, tasks.category_id AS categoryId, tasks.steps_json AS stepsJson, categories.name AS categoryName
        FROM tasks
        LEFT JOIN categories ON categories.id = tasks.category_id
        WHERE tasks.id = ?
      `)
      .get(id));
  }

  const addTaskTx = db.transaction((task: NewTaskEntry) => {
    const result = db
      .prepare("INSERT INTO tasks (title, notes, priority, due_date, repeat, category_id, steps_json) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(task.title.trim(), task.notes.trim(), task.priority, task.dueDate, task.repeat, task.categoryId, JSON.stringify(task.steps));
    const taskId = Number(result.lastInsertRowid);
    setTags(taskId, task.tags);
    const saved = getTask(taskId);
    upsertArtifact(db, {
      entityId: saved.id,
      entityType: "task",
      type: "task",
      title: saved.title,
      status: taskStatus(saved.tags),
      summary: saved.notes || ""
    });
    return saved;
  });

  function addTask(task: NewTaskEntry): TaskEntry {
    return addTaskTx({ ...task, tags: cleanTags(task.tags) });
  }

  const updateTaskTx = db.transaction((id: number, task: NewTaskEntry) => {
    const result = db
      .prepare("UPDATE tasks SET title = ?, notes = ?, priority = ?, due_date = ?, repeat = ?, category_id = ?, steps_json = ? WHERE id = ?")
      .run(task.title.trim(), task.notes.trim(), task.priority, task.dueDate, task.repeat, task.categoryId, JSON.stringify(task.steps), id);
    if (result.changes === 0) return null;
    setTags(id, task.tags);
    const updated = getTask(id);
    upsertArtifact(db, {
      entityId: updated.id,
      entityType: "task",
      type: "task",
      title: updated.title,
      status: taskStatus(updated.tags),
      summary: updated.notes || ""
    });
    return result.changes === 0 ? null : updated;
  });

  function updateTask(id: number, task: NewTaskEntry): TaskEntry | null {
    return updateTaskTx(id, { ...task, tags: cleanTags(task.tags) });
  }

  function toggleTask(id: number): TaskEntry | null {
    const result = db.prepare("UPDATE tasks SET done = CASE done WHEN 1 THEN 0 ELSE 1 END WHERE id = ?").run(id);
    return result.changes === 0 ? null : getTask(id);
  }

  function deleteTask(id: number): boolean {
    const deleted = db.prepare("DELETE FROM tasks WHERE id = ?").run(id).changes > 0;
    if (deleted) deleteArtifactForEntity(db, "task", id);
    return deleted;
  }

  return {
    addTask,
    close: () => db.close(),
    deleteTask,
    listTasks,
    toggleTask,
    updateTask
  };
}

function taskStatus(tags: string[]) {
  const tag = tags.find((current) => current.startsWith("status:"));
  return tag?.replace("status:", "") || "draft";
}
