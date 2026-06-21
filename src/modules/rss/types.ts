export type FeedEntry = {
  id: number;
  title: string;
  url: string;
  enabled: boolean;
};

export type NewFeedEntry = Omit<FeedEntry, "id" | "enabled"> & {
  enabled?: boolean;
};

export type FeedItemEntry = {
  id: number;
  feedId: number;
  feedTitle: string;
  title: string;
  url: string;
  publishedAt: string | null;
  status: "new" | "saved" | "ignored";
};

export type ParsedFeedItem = {
  title: string;
  url: string;
  publishedAt: string | null;
};
