export type RecipeEntry = {
  id: number;
  name: string;
  rating: number;
  categoryId: number | null;
  categoryName: string | null;
  notes: string;
  tags: string[];
};

export type NewRecipeEntry = Omit<RecipeEntry, "id" | "categoryName">;
