export type MealPlanEntry = {
  id: number;
  day: string;
  meal: string;
  notes: string;
};

export type NewMealPlanEntry = Omit<MealPlanEntry, "id">;
