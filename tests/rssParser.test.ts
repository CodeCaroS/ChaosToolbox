import assert from "node:assert/strict";
import test from "node:test";
import { parseFeedItems } from "../server/rssParser";

test("rss parser extracts rss and atom item links", () => {
  assert.deepEqual(parseFeedItems(`
    <rss><channel>
      <item>
        <title>One &amp; Two</title>
        <link>https://example.com/one</link>
        <description><![CDATA[Short <b>summary</b>.]]></description>
        <pubDate>Sun, 21 Jun 2026 10:00:00 GMT</pubDate>
      </item>
      <entry>
        <title>Atom Item</title>
        <link href="https://example.com/atom" />
        <summary>Atom summary.</summary>
        <updated>2026-06-21T10:00:00Z</updated>
      </entry>
    </channel></rss>
  `), [
    { title: "One & Two", url: "https://example.com/one", publishedAt: "Sun, 21 Jun 2026 10:00:00 GMT", summary: "Short summary." },
    { title: "Atom Item", url: "https://example.com/atom", publishedAt: "2026-06-21T10:00:00Z", summary: "Atom summary." }
  ]);
});
