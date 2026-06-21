import assert from "node:assert/strict";
import test from "node:test";
import { createTaskStore } from "../server/taskStore";

test("task store creates, toggles, updates and deletes tasks", () => {
  const store = createTaskStore(":memory:");
  const saved = store.addTask({
    title: "Modernize CookieCat",
    notes: "Move useful parts into toolbox",
    priority: 2,
    dueDate: "2026-06-20",
    repeat: "weekly",
    categoryId: null,
    tags: ["backup", "vue", "backup"],
    steps: [{ text: "Find old feature", done: false }]
  });

  assert.deepEqual(store.listTasks(), [{ ...saved, done: false }]);
  assert.deepEqual(store.toggleTask(saved.id), { ...saved, done: true });
  assert.deepEqual(store.updateTask(saved.id, {
    title: "Modernize tasks",
    notes: "",
    priority: 1,
    dueDate: null,
    repeat: "",
    categoryId: null,
    tags: ["tasks"],
    steps: [{ text: "Ship mini-goals", done: true }]
  }), {
    id: saved.id,
    title: "Modernize tasks",
    notes: "",
    priority: 1,
    done: true,
    dueDate: null,
    repeat: "",
    categoryId: null,
    categoryName: null,
    tags: ["tasks"],
    steps: [{ text: "Ship mini-goals", done: true }]
  });
  assert.equal(store.deleteTask(saved.id), true);
  assert.deepEqual(store.listTasks(), []);

  store.close();
});
