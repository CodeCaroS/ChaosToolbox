export type LibraryEntry = {
  id: number;
  title: string;
  author: string;
  series: string;
  status: "complete" | "incomplete";
  url: string;
  description: string;
  categoryId: number | null;
  categoryName: string | null;
  tags: string[];
};

export type NewLibraryEntry = Omit<LibraryEntry, "id" | "categoryName">;
