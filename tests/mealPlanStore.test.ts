import assert from "node:assert/strict";
import test from "node:test";
import { createMealPlanStore } from "../server/mealPlanStore";

test("meal plan store creates, updates and deletes planned meals", () => {
  const store = createMealPlanStore(":memory:");
  const saved = store.addMealPlanEntry({
    day: "Wednesday",
    meal: "Pasta",
    notes: "Use pantry ingredients"
  });

  assert.deepEqual(saved, {
    id: saved.id,
    day: "Wednesday",
    meal: "Pasta",
    notes: "Use pantry ingredients"
  });

  assert.deepEqual(store.updateMealPlanEntry(saved.id, { day: "Monday", meal: "Soup", notes: "" }), {
    id: saved.id,
    day: "Monday",
    meal: "Soup",
    notes: ""
  });
  assert.equal(store.deleteMealPlanEntry(saved.id), true);
  assert.deepEqual(store.listMealPlan(), []);
  store.close();
});
