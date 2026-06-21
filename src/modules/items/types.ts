export type ItemEntry = {
  id: number;
  name: string;
  type: string;
  quality: string;
  source: string;
  description: string;
  url: string;
};

export type NewItemEntry = Omit<ItemEntry, "id">;
