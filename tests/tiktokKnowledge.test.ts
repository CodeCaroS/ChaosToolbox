import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTikTokKnowledgeNote, extractTikTokImageUrls, extractTikwmImageUrls, fetchTranscript, type TranscriptProvider } from "../server/tiktokKnowledge";

test("fetchTranscript tries backup providers", async () => {
  const providers: TranscriptProvider[] = [
    async () => { throw new Error("transcript24 down"); },
    async () => ({ provider: "tokscript", transcript: "This is the fallback transcript text." })
  ];

  assert.deepEqual(await fetchTranscript("https://www.tiktok.com/@caro/video/123", providers), {
    provider: "tokscript",
    transcript: "This is the fallback transcript text."
  });
});

test("fetchTranscript skips provider service pages", async () => {
  const providers: TranscriptProvider[] = [
    async () => ({
      provider: "transcript24",
      transcript: "# Free YouTube Transcript Generator\n\n<style>.hero{display:block}</style>\nPaste a video URL to generate a transcript."
    }),
    async () => ({ provider: "tokscript", transcript: "Real TikTok transcript about building a useful local workflow." })
  ];

  assert.deepEqual(await fetchTranscript("https://www.tiktok.com/@caro/video/123", providers), {
    provider: "tokscript",
    transcript: "Real TikTok transcript about building a useful local workflow."
  });
});

test("createTikTokKnowledgeNote writes generated note to inbox", async () => {
  const root = mkdtempSync(join(tmpdir(), "chaostoolbox-tiktok-note-"));
  const templateDir = join(root, "99-system", "templates");
  const providers: TranscriptProvider[] = [
    async () => ({ provider: "transcript24", transcript: "Transcript about weekly AI learning loops." })
  ];

  const result = await createTikTokKnowledgeNote(
    "https://www.tiktok.com/@caro/video/123",
    root,
    providers,
    async ({ transcript, template }) => {
      assert.equal(transcript, "Transcript about weekly AI learning loops.");
      assert.equal(template, "");
      return [
        "---",
        "title: \"AI Weekly Learning Loop\"",
        "type: ai-capture",
        "status: inbox",
        "---",
        "",
        "# AI Weekly Learning Loop",
        "",
        "Useful note."
      ].join("\n");
    }
  );

  assert.equal(result.provider, "transcript24");
  assert.match(result.path, /^00-inbox\/ai-captures\/\d{4}-\d{2}-\d{2}-ai-weekly-learning-loop-[a-f0-9]{6}\.md$/);
  assert.equal(existsSync(join(root, result.path)), true);
  assert.match(readFileSync(join(root, result.path), "utf8"), /Useful note\.\n$/);
  assert.equal(existsSync(templateDir), false);
});

test("createTikTokKnowledgeNote uses OCR for photo posts", async () => {
  const root = mkdtempSync(join(tmpdir(), "chaostoolbox-tiktok-photo-note-"));
  mkdirSync(join(root, "99-system", "templates"), { recursive: true });
  writeFileSync(join(root, "99-system", "templates", "ai-capture.template.md"), "template");

  const result = await createTikTokKnowledgeNote(
    "https://www.tiktok.com/@caro/photo/123",
    root,
    [async () => { throw new Error("video provider should not run"); }],
    async ({ transcript }) => `---\ntitle: Photo OCR Note\n---\n${transcript}`,
    async () => ({ provider: "tiktok-photo-ocr", transcript: "Readable text from TikTok photo images." })
  );

  assert.equal(result.provider, "tiktok-photo-ocr");
  assert.equal(result.title, "Photo OCR Note");
});

test("extractTikTokImageUrls reads escaped TikTok image urls", () => {
  assert.deepEqual(
    extractTikTokImageUrls('{"urlList":["https:\\/\\/p16-sign-va.tiktokcdn.com\\/tos-useast2a-p\\/image.jpeg?x=1"]}'),
    ["https://p16-sign-va.tiktokcdn.com/tos-useast2a-p/image.jpeg?x=1"]
  );
});

test("extractTikwmImageUrls reads photo image urls", () => {
  assert.deepEqual(
    extractTikwmImageUrls({ data: { images: ["https://p16-common-sign.tiktokcdn-us.com/photo.jpeg", "bad"] } }),
    ["https://p16-common-sign.tiktokcdn-us.com/photo.jpeg"]
  );
});
