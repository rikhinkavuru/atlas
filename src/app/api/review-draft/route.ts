import { NextRequest } from "next/server";
import { formatVoiceForPrompt } from "@/lib/voice";

export const runtime = "nodejs";

type Provider = "openai" | "anthropic" | "mock";

interface Body {
  comment: string;
  paperHtml: string;
  paperTitle: string;
  reviewer: string;
  voice?: any;
}

const SYSTEM = `You draft a single response to one reviewer comment for an academic paper. The user is the manuscript author. You write in the author's voice (if provided), grounded in the manuscript.

OUTPUT FORMAT (strict): a single JSON object:
{
  "response": "<the response text, 2-6 sentences>",
  "linkedQuote": "<short verbatim quote from the manuscript that the response references, if any>"
}

Rules:
- Never agree with a comment that contradicts the manuscript; instead, politely point to where the manuscript already addresses the point.
- If the comment requires a real change, draft a concrete commitment ("In the revision we added X to Section Y") but DO NOT invent results, numbers, or experiments not in the manuscript.
- Tone: professional, direct, no grovelling.
- 2-6 sentences. No headings.
- Return ONLY the JSON.`;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Partial<Body>;
  if (typeof body.comment !== "string" || body.comment.trim().length === 0) {
    return Response.json(
      { error: "missing_comment" },
      { status: 400 },
    );
  }
  // Truncate to prevent a 1MB comment burning tokens / hitting the model limit.
  body.comment = body.comment.trim().slice(0, 6000);
  body.paperTitle = (body.paperTitle ?? "Untitled").slice(0, 200);
  body.paperHtml = (body.paperHtml ?? "").slice(0, 60000);
  body.reviewer = (body.reviewer ?? "Reviewer").slice(0, 80);
  const provider = (req.headers.get("x-provider") ?? "openai") as Provider;
  const openaiKey =
    req.headers.get("x-openai-key") || process.env.OPENAI_API_KEY || "";
  const anthropicKey =
    req.headers.get("x-anthropic-key") || process.env.ANTHROPIC_API_KEY || "";
  const model =
    req.headers.get("x-model") ||
    (provider === "anthropic" ? "claude-haiku-4-5-20251001" : "gpt-4o-mini");
  const voicePrompt = formatVoiceForPrompt(body.voice ?? null);

  const docPlain = htmlToText(body.paperHtml ?? "").slice(0, 10000);
  const user = [
    `# Manuscript title\n${body.paperTitle}`,
    `# Manuscript (truncated)\n${docPlain}`,
    voicePrompt,
    `# Reviewer label\n${body.reviewer}`,
    `# Reviewer comment\n${body.comment}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    if (provider === "openai" && openaiKey) {
      const out = await callOpenAI(model, openaiKey, user);
      if (out) return Response.json(out);
    }
    if (provider === "anthropic" && anthropicKey) {
      const out = await callAnthropic(model, anthropicKey, user);
      if (out) return Response.json(out);
    }
  } catch {}
  return Response.json({
    response:
      "We thank the reviewer for this comment. To address it, we plan to add a clarifying passage in the relevant section. [Replace this draft once an API key is configured.]",
    linkedQuote: null,
  });
}

async function callOpenAI(model: string, key: string, user: string) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
    }),
  });
  if (!r.ok) return null;
  const data = (await r.json()) as any;
  return parse(data.choices?.[0]?.message?.content ?? "{}");
}

async function callAnthropic(model: string, key: string, user: string) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      temperature: 0.3,
      system: SYSTEM + "\n\nReturn ONLY the JSON object.",
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!r.ok) return null;
  const data = (await r.json()) as any;
  return parse(data.content?.[0]?.text ?? "{}");
}

function parse(raw: string) {
  try {
    let cleaned = raw.trim();
    const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) cleaned = fence[1].trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) cleaned = cleaned.slice(start, end + 1);
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|h[1-6]|li|tr|blockquote|div)>/gi, "\n")
    .replace(/<br\s*\/?>(?!\n)/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
