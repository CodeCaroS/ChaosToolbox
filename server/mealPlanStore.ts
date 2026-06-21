import Database from "better-sqlite3";
import type { MealPlanEntry, NewMealPlanEntry } from "../src/modules/mealplan/types";

const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function createMealPlanStore(filename: string) {
  const db = new Database(filename);
  db.exec(`
    CREATE TABLE IF NOT EXISTS meal_plan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT NOT NULL,
      meal TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT ''
    );
  `);

  function getMealPlanEntry(id: number): MealPlanEntry {
    return db.prepare("SELECT id, day, meal, notes FROM meal_plan WHERE id = ?").get(id) as MealPlanEntry;
  }

  function listMealPlan(): MealPlanEntry[] {
    return (db.prepare("SELECT id, day, meal, notes FROM meal_plan").all() as MealPlanEntry[]).sort((a, b) => {
      const dayCompare = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
      return dayCompare || a.id - b.id;
    });
  }

  function addMealPlanEntry(entry: NewMealPlanEntry): MealPlanEntry {
    const result = db
      .prepare("INSERT INTO meal_plan (day, meal, notes) VALUES (?, ?, ?)")
      .run(entry.day.trim(), entry.meal.trim(), entry.notes.trim());
    return getMealPlanEntry(Number(result.lastInsertRowid));
  }

  function updateMealPlanEntry(id: number, entry: NewMealPlanEntry): MealPlanEntry | null {
    const result = db
      .prepare("UPDATE meal_plan SET day = ?, meal = ?, notes = ? WHERE id = ?")
      .run(entry.day.trim(), entry.meal.trim(), entry.notes.trim(), id);
    return result.changes === 0 ? null : getMealPlanEntry(id);
  }

  function deleteMealPlanEntry(id: number): boolean {
    return db.prepare("DELETE FROM meal_plan WHERE id = ?").run(id).changes > 0;
  }

  return {
    addMealPlanEntry,
    close: () => db.close(),
    deleteMealPlanEntry,
    listMealPlan,
    updateMealPlanEntry
  };
}
