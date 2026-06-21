import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createRssStore } from "../server/rssStore";

test("rss store creates feeds and upserts feed items", () => {
  const filename = join(mkdtempSync(join(tmpdir(), "chaostoolbox-rss-")), "rss.sqlite");
  const rss = createRssStore(filename);
  const feed = rss.addFeed({ title: "Dev Feed", url: "https://example.com/rss.xml" });

  assert.deepEqual(rss.listFeeds(), [{ ...feed, enabled: true }]);
  assert.deepEqual(rss.upsertFeedItems(feed.id, [
    { title: "First", url: "https://example.com/1", publishedAt: "2026-06-21" },
    { title: "Second", url: "https://example.com/2", publishedAt: null }
  ]), { created: 2, unchanged: 0 });
  assert.deepEqual(rss.upsertFeedItems(feed.id, [
    { title: "First", url: "https://example.com/1", publishedAt: "2026-06-21" }
  ]), { created: 0, unchanged: 1 });

  assert.equal(rss.markFeedItem(feed.id, "https://example.com/1", "saved"), true);
  assert.equal(rss.markFeedItem(feed.id, "https://example.com/2", "ignored"), true);
  assert.deepEqual(rss.listFeedItems(), [
    {
      id: 2,
      feedId: feed.id,
      feedTitle: "Dev Feed",
      title: "Second",
      url: "https://example.com/2",
      publishedAt: null,
      status: "ignored"
    },
    {
      id: 1,
      feedId: feed.id,
      feedTitle: "Dev Feed",
      title: "First",
      url: "https://example.com/1",
      publishedAt: "2026-06-21",
      status: "saved"
    }
  ]);

  rss.close();
});
