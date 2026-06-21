import { parseFeedItems } from "./rssParser";
import type { createRssStore } from "./rssStore";

type RssStore = ReturnType<typeof createRssStore>;

export type RssRefreshResult = {
  feeds: number;
  created: number;
  unchanged: number;
  failed: number;
};

export async function refreshEnabledFeeds(store: RssStore, fetchText: (url: string) => Promise<string> = fetchUrl): Promise<RssRefreshResult> {
  const result: RssRefreshResult = { feeds: 0, created: 0, unchanged: 0, failed: 0 };

  for (const feed of store.listFeeds().filter((current) => current.enabled)) {
    try {
      const imported = store.upsertFeedItems(feed.id, parseFeedItems(await fetchText(feed.url)));
      result.feeds += 1;
      result.created += imported.created;
      result.unchanged += imported.unchanged;
    } catch {
      result.failed += 1;
    }
  }

  return result;
}

async function fetchUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("feed fetch failed");
  return response.text();
}
