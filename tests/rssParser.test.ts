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

test("rss parser prefers atom alternate links over enclosures", () => {
  assert.deepEqual(parseFeedItems(`
    <feed>
      <entry>
        <title>Atom Media</title>
        <link rel="enclosure" href="https://example.com/audio.mp3" />
        <link rel="alternate" href="https://example.com/post" />
      </entry>
    </feed>
  `), [
    { title: "Atom Media", url: "https://example.com/post", publishedAt: null, summary: "" }
  ]);
});

test("rss parser decodes numeric html entities", () => {
  assert.deepEqual(parseFeedItems(`
    <rss><channel>
      <item>
        <title>Carol&#8217;s update &#x2713;</title>
        <link>https://example.com/update</link>
        <description>Done&#58; ship it.</description>
      </item>
    </channel></rss>
  `), [
    { title: "Carol\u2019s update \u2713", url: "https://example.com/update", publishedAt: null, summary: "Done: ship it." }
  ]);
});

test("rss parser uses permalink guid when link is missing", () => {
  assert.deepEqual(parseFeedItems(`
    <rss><channel>
      <item>
        <title>Guid Item</title>
        <guid isPermaLink="true">https://example.com/guid</guid>
      </item>
    </channel></rss>
  `), [
    { title: "Guid Item", url: "https://example.com/guid", publishedAt: null, summary: "" }
  ]);
});
