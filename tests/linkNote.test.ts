import assert from "node:assert/strict";
import test from "node:test";
import { readModeText } from "../server/linkNote";

test("readModeText strips html chrome into readable text", async () => {
  const fetchFn = async () => new Response(`
    <html>
      <style>.hidden{}</style>
      <script>ignore()</script>
      <main><h1>Title</h1><p>Readable &amp; useful text.</p></main>
    </html>
  `, { headers: { "Content-Type": "text/html" } });

  const text = await readModeText("https://example.com", fetchFn as typeof fetch);

  assert.equal(text, "Title Readable & useful text.");
});
