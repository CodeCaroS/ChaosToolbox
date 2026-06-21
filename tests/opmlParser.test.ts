import assert from "node:assert/strict";
import test from "node:test";
import { parseOpmlFeeds } from "../server/opmlParser";

test("opml parser extracts feed titles and xml urls", () => {
  assert.deepEqual(parseOpmlFeeds(`
    <opml><body>
      <outline text="Dev" title="Dev Feed" xmlUrl="https://example.com/dev.xml" />
      <outline text="Ignored folder">
        <outline text="AI Feed" xmlUrl="https://example.com/ai.xml" />
      </outline>
    </body></opml>
  `), [
    { title: "Dev Feed", url: "https://example.com/dev.xml" },
    { title: "AI Feed", url: "https://example.com/ai.xml" }
  ]);
});
