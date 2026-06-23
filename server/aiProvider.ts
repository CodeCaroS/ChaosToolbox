import type { NoteFormMetadata } from "../src/modules/notes/frontmatter";

export type NoteMetadataInput = {
  title: string;
  body: string;
};

export type KnowledgeNoteInput = {
  url: string;
  transcript: string;
  template: string;
};

export type LinkNoteInput = {
  title: string;
  url: string;
  source: string;
  text: string;
};

export type OcrImageInput = {
  url: string;
  images: Array<{ mimeType: string; data: string }>;
};

type Env = Partial<Record<"AI_PROVIDER" | "AI_MODEL" | "GEMINI_API_KEY" | "GOOGLE_API_KEY" | "ai_gemini" | "CEREBRAS_API_KEY" | "CEREBRAS_MODEL" | "ai_cerebras" | "MISTRAL_API_KEY" | "MISTRAL_MODEL" | "ai_mistral", string>>;
type FetchFn = typeof fetch;

export async function suggestNoteMetadata(input: NoteMetadataInput, env: Env = process.env, fetchFn: FetchFn = fetch): Promise<NoteFormMetadata> {
  const text = await generateText(prompt(input), env, fetchFn, "AI metadata suggestion failed");
  return cleanSuggestion(JSON.parse(extractJson(text)) as NoteFormMetadata);
}

export async function generateKnowledgeNote(input: KnowledgeNoteInput, env: Env = process.env, fetchFn: FetchFn = fetch): Promise<string> {
  const markdown = extractMarkdown(await generateText(knowledgePrompt(input), env, fetchFn, "AI knowledge note generation failed"));
  if (!markdown.includes("---")) throw new Error("AI knowledge note generation returned no markdown");
  return markdown;
}

export async function generateLinkNote(input: LinkNoteInput, env: Env = process.env, fetchFn: FetchFn = fetch): Promise<string> {
  const markdown = extractMarkdown(await generateText(linkNotePrompt(input), env, fetchFn, "AI link note generation failed"));
  if (!markdown.includes("---")) throw new Error("AI link note generation returned no markdown");
  return markdown;
}

export async function ocrTikTokImages(input: OcrImageInput, env: Env = process.env, fetchFn: FetchFn = fetch): Promise<string> {
  const apiKey = env.ai_gemini || env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
  const provider = env.AI_PROVIDER || (env.ai_gemini ? "gemini" : undefined);
  if (provider !== "gemini") throw new Error("AI_PROVIDER must be gemini");
  if (!apiKey) throw new Error("ai_gemini is required");

  const model = env.AI_MODEL || "gemini-2.5-flash";
  const response = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          { text: `Extract all readable text from these TikTok photo post images. Return plain text only.\nURL: ${input.url}` },
          ...input.images.map((image) => ({ inline_data: { mime_type: image.mimeType, data: image.data } }))
        ]
      }]
    })
  });

  if (!response.ok) throw new Error(`AI photo OCR failed (${response.status}): ${await responseError(response)}`);
  const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim() ?? "";
  if (text.length < 20) throw new Error("AI photo OCR returned no text");
  return text;
}

async function generateText(promptText: string, env: Env, fetchFn: FetchFn, errorMessage: string): Promise<string> {
  const provider = env.AI_PROVIDER || (geminiApiKey(env) ? "gemini" : cerebrasApiKey(env) ? "cerebras" : mistralApiKey(env) ? "mistral" : undefined);
  if (provider !== "gemini" && provider !== "cerebras" && provider !== "mistral") throw new Error("AI_PROVIDER must be gemini, cerebras, or mistral");

  if (provider === "cerebras") {
    return generateCerebrasText(promptText, env, fetchFn, errorMessage);
  }
  if (provider === "mistral") {
    return generateMistralText(promptText, env, fetchFn, errorMessage);
  }

  const attempts: Array<() => Promise<string>> = [() => generateGeminiText(promptText, env, fetchFn, errorMessage)];
  if (cerebrasApiKey(env)) attempts.push(() => generateCerebrasText(promptText, env, fetchFn, errorMessage));
  if (mistralApiKey(env)) attempts.push(() => generateMistralText(promptText, env, fetchFn, errorMessage));

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(errorMessage);
}

async function generateGeminiText(promptText: string, env: Env, fetchFn: FetchFn, errorMessage: string): Promise<string> {
  const apiKey = geminiApiKey(env);
  if (!apiKey) throw new Error("ai_gemini is required");

  const model = env.AI_MODEL || "gemini-2.5-flash";
  const response = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [{ text: promptText }]
      }]
    })
  });

  if (!response.ok) throw new Error(`${errorMessage}${await responseFailureSuffix(response)}`);
  const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function generateCerebrasText(promptText: string, env: Env, fetchFn: FetchFn, errorMessage: string): Promise<string> {
  const apiKey = cerebrasApiKey(env);
  if (!apiKey) throw new Error("ai_cerebras is required");

  const response = await fetchFn("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: promptText }],
      model: env.CEREBRAS_MODEL || "gpt-oss-120b",
      max_completion_tokens: 1024,
      temperature: 0.2,
      top_p: 1,
      stream: false,
      reasoning_effort: "medium"
    })
  });

  if (!response.ok) throw new Error(`${errorMessage}${await responseFailureSuffix(response)}`);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return extractOpenAIMessageContent(data.choices?.[0]?.message?.content);
}

async function generateMistralText(promptText: string, env: Env, fetchFn: FetchFn, errorMessage: string): Promise<string> {
  const apiKey = mistralApiKey(env);
  if (!apiKey) throw new Error("ai_mistral is required");

  const response = await fetchFn("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: promptText }],
      model: env.MISTRAL_MODEL || "mistral-large-latest",
      max_tokens: 1024,
      temperature: 0.2,
      top_p: 1,
      stream: false
    })
  });

  if (!response.ok) throw new Error(`${errorMessage}${await responseFailureSuffix(response)}`);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }> };
  return extractOpenAIMessageContent(data.choices?.[0]?.message?.content);
}

function geminiApiKey(env: Env): string | undefined {
  return env.ai_gemini || env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
}

function cerebrasApiKey(env: Env): string | undefined {
  return env.ai_cerebras || env.CEREBRAS_API_KEY;
}

function mistralApiKey(env: Env): string | undefined {
  return env.ai_mistral || env.MISTRAL_API_KEY;
}

function prompt(input: NoteMetadataInput): string {
  return `Suggest note metadata as JSON only with keys kind,status,topic,tags,summary.
Allowed kind: knowledge, source, project, decision, task, review, archive.
Allowed status: draft, active, review, refined, archived.
topic should be a short descriptive topic or empty if unclear.
tags must be short lowercase strings.

Title: ${JSON.stringify(input.title)}
Body: ${JSON.stringify(input.body.slice(0, 8000))}`;
}

function knowledgePrompt(input: KnowledgeNoteInput): string {
  return `Build one German knowledge note from this TikTok transcript.
Return markdown only. Follow the template shape and frontmatter keys where useful.
Set status: inbox, type/kind: ai-capture, source type: tiktok, source_url to the URL.
Do not invent facts beyond the transcript. Keep it concise but useful.

URL: ${input.url}

Template:
${input.template.slice(0, 6000)}

Transcript:
${input.transcript.slice(0, 20000)}`;
}

function linkNotePrompt(input: LinkNoteInput): string {
  return `Build one German inbox note from this readable link text.
Return markdown only.
Use YAML frontmatter with title, status: inbox, kind: source, tags, source_url, source_type.
Do not invent facts beyond the source text. Keep it concise and useful.

Title: ${input.title}
URL: ${input.url}
Source: ${input.source}

Readable text:
${input.text.slice(0, 20000)}`;
}

function extractJson(value: string): string {
  return value.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
}

function extractOpenAIMessageContent(value: string | Array<{ type?: string; text?: string }> | undefined): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value.map((part) => part.text ?? "").join("\n").trim();
}

async function responseError(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    return parsed.error?.message || text || response.statusText;
  } catch (_error) {
    return text || response.statusText;
  }
}

async function responseFailureSuffix(response: Response): Promise<string> {
  return ` (${response.status}): ${await responseError(response)}`;
}

function extractMarkdown(value: string): string {
  return value.replace(/^```(?:markdown|md)?\s*/i, "").replace(/```\s*$/i, "").trim();
}

function cleanSuggestion(value: NoteFormMetadata): NoteFormMetadata {
  return {
    kind: value.kind || "knowledge",
    status: value.status || "draft",
    topic: value.topic ? String(value.topic).trim() : "",
    tags: Array.isArray(value.tags) ? value.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 8) : [],
    summary: value.summary ? String(value.summary).trim() : ""
  };
}
