import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKnowledgeNote, generateLinkNote, suggestNoteMetadata } from "../server/aiProvider";

test("suggestNoteMetadata calls configured Gemini model and parses JSON", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchFn = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify({
      candidates: [{
        content: { parts: [{ text: '{"kind":"knowledge","status":"draft","topic":"AI Strategy","tags":["ai"],"summary":"Short"}' }] }
      }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const result = await suggestNoteMetadata(
    { title: "Home", body: "Body" },
    { AI_PROVIDER: "gemini", AI_MODEL: "gemini-test", GEMINI_API_KEY: "test-key" },
    fetchFn
  );

  assert.equal(calls[0]?.url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent");
  assert.equal(new Headers(calls[0]?.init.headers).get("x-goog-api-key"), "test-key");
  assert.deepEqual(result, { kind: "knowledge", status: "draft", topic: "AI Strategy", tags: ["ai"], summary: "Short" });
});

test("suggestNoteMetadata accepts ai_gemini env key", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchFn = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify({
      candidates: [{
        content: { parts: [{ text: '{"kind":"knowledge","status":"draft","topic":"","tags":[],"summary":""}' }] }
      }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  await suggestNoteMetadata({ title: "Home", body: "Body" }, { ai_gemini: "test-key" }, fetchFn);

  assert.equal(new Headers(calls[0]?.init.headers).get("x-goog-api-key"), "test-key");
});

test("suggestNoteMetadata fails closed without provider config", async () => {
  await assert.rejects(() => suggestNoteMetadata({ title: "Home", body: "Body" }, {}, fetch), /AI_PROVIDER/);
});

test("generateKnowledgeNote includes Gemini error details", async () => {
  const fetchFn = async () => new Response(JSON.stringify({ error: { message: "API key not valid" } }), { status: 400 });

  await assert.rejects(
    () => generateKnowledgeNote(
      { url: "https://www.tiktok.com/@github.awesome/video/7633983251463326990", transcript: "Transcript text with enough content.", template: "" },
      { AI_PROVIDER: "gemini", AI_MODEL: "gemini-test", GEMINI_API_KEY: "bad-key" },
      fetchFn
    ),
    /AI knowledge note generation failed \(400\): API key not valid/
  );
});

test("generateLinkNote asks for inbox source markdown", async () => {
  const fetchFn = async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { contents: Array<{ parts: Array<{ text: string }> }> };
    assert.match(body.contents[0]?.parts[0]?.text ?? "", /status: inbox/);
    assert.match(body.contents[0]?.parts[0]?.text ?? "", /source_url/);
    return new Response(JSON.stringify({
      candidates: [{
        content: { parts: [{ text: "---\ntitle: Link\nstatus: inbox\nkind: source\n---\nNote" }] }
      }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const result = await generateLinkNote(
    { title: "Link", url: "https://example.com", source: "rss", text: "Readable source text with enough content." },
    { AI_PROVIDER: "gemini", GEMINI_API_KEY: "test-key" },
    fetchFn
  );

  assert.match(result, /status: inbox/);
});

test("suggestNoteMetadata prompt includes topic output", async () => {
  const fetchFn = async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { contents: Array<{ parts: Array<{ text: string }> }> };
    assert.match(body.contents[0]?.parts[0]?.text ?? "", /topic/);
    return new Response(JSON.stringify({
      candidates: [{
        content: { parts: [{ text: '{"kind":"knowledge","status":"draft","topic":"AI Strategy","tags":[],"summary":""}' }] }
      }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const result = await suggestNoteMetadata({ title: "Home", body: "Body" }, { AI_PROVIDER: "gemini", GEMINI_API_KEY: "test-key" }, fetchFn);

  assert.equal(result.topic, "AI Strategy");
});


test("suggestNoteMetadata falls back to Cerebras when Gemini fails", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchFn = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    if (String(url).includes("generativelanguage.googleapis.com")) {
      return new Response(JSON.stringify({ error: { message: "Gemini unavailable" } }), { status: 503 });
    }
    return new Response(JSON.stringify({
      choices: [{
        message: { content: '{"kind":"source","status":"active","tags":["fallback"],"summary":"From Cerebras"}' }
      }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const result = await suggestNoteMetadata(
    { title: "Home", body: "Body" },
    { ai_gemini: "gemini-key", ai_cerebras: "cerebras-key" },
    fetchFn
  );

  assert.equal(calls[1]?.url, "https://api.cerebras.ai/v1/chat/completions");
  assert.equal(new Headers(calls[1]?.init.headers).get("authorization"), "Bearer cerebras-key");
  assert.equal(JSON.parse(String(calls[1]?.init.body)).model, "gpt-oss-120b");
  assert.deepEqual(result, { kind: "source", status: "active", topic: "", tags: ["fallback"], summary: "From Cerebras" });
});

test("suggestNoteMetadata falls back to Mistral when Gemini and Cerebras fail", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchFn = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    if (String(url).includes("generativelanguage.googleapis.com")) {
      return new Response(JSON.stringify({ error: { message: "Gemini unavailable" } }), { status: 503 });
    }
    if (String(url).includes("api.cerebras.ai")) {
      return new Response(JSON.stringify({ error: { message: "Cerebras unavailable" } }), { status: 503 });
    }
    return new Response(JSON.stringify({
      choices: [{
        message: { content: '{"kind":"task","status":"review","tags":["mistral"],"summary":"From Mistral"}' }
      }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const result = await suggestNoteMetadata(
    { title: "Home", body: "Body" },
    { ai_gemini: "gemini-key", ai_cerebras: "cerebras-key", ai_mistral: "mistral-key" },
    fetchFn
  );

  assert.equal(calls[2]?.url, "https://api.mistral.ai/v1/chat/completions");
  assert.equal(new Headers(calls[2]?.init.headers).get("authorization"), "Bearer mistral-key");
  assert.equal(JSON.parse(String(calls[2]?.init.body)).model, "mistral-large-latest");
  assert.deepEqual(result, { kind: "task", status: "review", topic: "", tags: ["mistral"], summary: "From Mistral" });
});
