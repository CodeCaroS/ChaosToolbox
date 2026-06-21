export type LinkEntry = {
  id: number;
  title: string;
  description: string;
  url: string;
  categoryId: number | null;
  categoryName: string | null;
  tags: string[];
};

export type NewLinkEntry = Omit<LinkEntry, "id" | "categoryName">;
