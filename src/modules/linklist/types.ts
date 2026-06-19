export type LinkEntry = {
  id: number;
  title: string;
  description: string;
  url: string;
  tags: string[];
};

export type NewLinkEntry = Omit<LinkEntry, "id">;
