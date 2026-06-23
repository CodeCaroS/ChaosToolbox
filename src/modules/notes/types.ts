export type NoteMetadata = {
  title?: string;
  kind?: string;
  status?: string;
  topic?: string;
  tags?: string[];
  sourceType?: string;
  summary?: string;
  description?: string;
  extraYaml?: string;
};

export type NoteEntry = {
  id: number;
  title: string;
  body: string;
  categoryId: number | null;
  categoryName: string | null;
  sourcePath?: string | null;
  meta?: NoteMetadata | null;
};

export type NewNoteEntry = Omit<NoteEntry, "id" | "categoryName">;
