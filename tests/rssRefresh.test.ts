import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { refreshEnabledFeeds } from "../server/rssRefresh";
import { createRssStore } from "../server/rssStore";

test("refreshes enabled rss feeds and stores new items", async () => {
  const filename = join(mkdtempSync(join(tmpdir(), "chaostoolbox-rss-refresh-")), "rss.sqlite");
  const rss = createRssStore(filename);
  rss.addFeed({ title: "Dev Feed", url: "https://example.com/rss.xml" });
  rss.addFeed({ title: "Off", url: "https://example.com/off.xml", enabled: false });

  const result = await refreshEnabledFeeds(rss, async (url) => {
    assert.equal(url, "https://example.com/rss.xml");
    return `<rss><channel><item><title>First</title><link>https://example.com/1</link></item></channel></rss>`;
  });

  assert.deepEqual(result, { feeds: 1, created: 1, unchanged: 0, failed: 0 });
  assert.equal(rss.listFeedItems("new").length, 1);
  rss.close();
});
