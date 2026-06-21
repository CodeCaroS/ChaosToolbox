export type AssetEntry = {
  id: number;
  title: string;
  imageUrl: string;
  gallery: string;
  description: string;
  categoryId: number | null;
  categoryName: string | null;
};

export type NewAssetEntry = Omit<AssetEntry, "id" | "categoryName">;
