export type NoteEntry = {
  id: number;
  title: string;
  body: string;
  categoryId: number | null;
  categoryName: string | null;
};

export type NewNoteEntry = Omit<NoteEntry, "id" | "categoryName">;
