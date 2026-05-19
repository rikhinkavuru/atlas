import { NextRequest } from "next/server";
import type { ReviewerItem } from "@/types";
import { ollamaChat } from "@/lib/ollama";

export const runtime = "nodejs";

type Provider = "openai" | "anthropic" | "ollama" | "mock";

const SYSTEM = `You parse reviewer comment dumps for academic manuscripts. The user pastes raw reviewer text — possibly from PDF, OpenReview, email, or a journal editor. Your job is to identify discrete comments and structure them.

OUTPUT FORMAT (strict): A single JSON object:
{
  "items": [
    {
      "number": "<R1.1, R2.3, M3, A4, or just 1, 2, 3>",
      "reviewerLabel": "<Reviewer 1 / Reviewer 2 / Editor / Meta-reviewer>",
      "comment": "<the verbatim comment text>"
    }
  ]
}

Rules:
- Preserve the comment text exactly. Do not paraphrase. Do not invent comments.
- One comment per item — split multi-part comments by sub-bullets.
- Order items as they appear in the source.
- If you cannot find any comments, return {"items":[]}.
- Output ONLY the JSON.`;

export async function POST(req: NextRequest) {
  const { rawText } = (await req.json()) as { rawText: string };
  const provider = (req.headers.get("x-provider") ?? "openai") as Provider;
  const openaiKey =
    req.headers.get("x-openai-key") || process.env.OPENAI_API_KEY || "";
  const anthropicKey =
    req.headers.get("x-anthropic-key") || process.env.ANTHROPIC_API_KEY || "";
  const ollamaUrl =
    req.headers.get("x-ollama-url") ||
    process.env.OLLAMA_URL ||
    "http://localhost:11434";
  const model =
    req.headers.get("x-model") ||
    (provider === "anthropic"
      ? "claude-haiku-4-5-20251001"
      : provider === "ollama"
        ? "llama3.2"
        : "gpt-4o-mini");

  if (!rawText || rawText.trim().length === 0) {
    return Response.json({ items: [] });
  }

  try {
    let items: Omit<ReviewerItem, "id" | "response" | "status">[] = [];
    if (provider === "openai" && openaiKey) {
      items = (await callOpenAI(model, openaiKey, rawText)) ?? [];
    } else if (provider === "anthropic" && anthropicKey) {
      items = (await callAnthropic(model, anthropicKey, rawText)) ?? [];
    } else if (provider === "ollama") {
      items = (await callOllama(model, ollamaUrl, rawText)) ?? [];
    }
    if (items.length === 0) {
      items = heuristicParse(rawText);
    }
    const structured: ReviewerItem[] = items.map((it, idx) => ({
      id: `ri_${Date.now()}_${idx}`,
      number: it.number || String(idx + 1),
      reviewerLabel: it.reviewerLabel || "Reviewer",
      comment: it.comment || "",
      response: "",
      status: "todo",
    }));
    return Response.json({ items: structured });
  } catch {
    const items = heuristicParse(rawText).map((it, idx) => ({
      ...it,
      id: `ri_${Date.now()}_${idx}`,
      response: "",
      status: "todo" as const,
    }));
    return Response.json({ items });
  }
}

async function callOpenAI(
  model: string,
  key: string,
  raw: string,
): Promise<Omit<ReviewerItem, "id" | "response" | "status">[] | null> {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: raw },
      ],
    }),
  });
  if (!r.ok) return null;
  const data = (await r.json()) as any;
  return parseItems(data.choices?.[0]?.message?.content ?? "{}");
}

async function callAnthropic(
  model: string,
  key: string,
  raw: string,
): Promise<Omit<ReviewerItem, "id" | "response" | "status">[] | null> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 3000,
      temperature: 0.1,
      system: SYSTEM + "\n\nReturn ONLY the JSON object.",
      messages: [{ role: "user", content: raw }],
    }),
  });
  if (!r.ok) return null;
  const data = (await r.json()) as any;
  return parseItems(data.content?.[0]?.text ?? "{}");
}

async function callOllama(
  model: string,
  url: string,
  raw: string,
): Promise<Omit<ReviewerItem, "id" | "response" | "status">[] | null> {
  try {
    const text = await ollamaChat({
      url,
      model,
      temperature: 0.1,
      jsonMode: true,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: raw },
      ],
    });
    return parseItems(text);
  } catch {
    return null;
  }
}

function parseItems(raw: string) {
  try {
    let cleaned = raw.trim();
    const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) cleaned = fence[1].trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) cleaned = cleaned.slice(start, end + 1);
    const parsed = JSON.parse(cleaned);
    return (parsed.items ?? []) as Omit<ReviewerItem, "id" | "response" | "status">[];
  } catch {
    return null;
  }
}

function heuristicParse(
  raw: string,
): Omit<ReviewerItem, "id" | "response" | "status">[] {
  const items: Omit<ReviewerItem, "id" | "response" | "status">[] = [];
  let currentReviewer = "Reviewer 1";
  // Split on common reviewer headers, then on numbered/bulleted lines
  const blocks = raw.split(/\n\s*\n+/);
  for (const block of blocks) {
    const reviewerMatch = block.match(
      /^(Reviewer\s+\d+|Meta[- ]?reviewer|Editor|Area Chair|AC)\s*:?/i,
    );
    if (reviewerMatch) {
      currentReviewer = reviewerMatch[1];
    }
    const lines = block.split(/\n/);
    let buffer: string[] = [];
    let buffer_num: string | null = null;
    const flush = () => {
      if (buffer.length === 0) return;
      items.push({
        number: buffer_num || `${items.length + 1}`,
        reviewerLabel: currentReviewer,
        comment: buffer.join(" ").trim(),
      });
      buffer = [];
      buffer_num = null;
    };
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      const numMatch = t.match(/^([RWQAM]?\d+(?:\.\d+)?)\.?\s+(.*)$/i);
      const bulletMatch = t.match(/^[-*•]\s+(.*)$/);
      if (numMatch) {
        flush();
        buffer_num = numMatch[1];
        buffer.push(numMatch[2]);
      } else if (bulletMatch) {
        flush();
        buffer.push(bulletMatch[1]);
      } else if (/^(Reviewer\s+\d+|Editor|Meta[- ]?reviewer)/i.test(t)) {
        flush();
      } else {
        buffer.push(t);
      }
    }
    flush();
  }
  if (items.length === 0 && raw.trim()) {
    items.push({
      number: "1",
      reviewerLabel: "Reviewer 1",
      comment: raw.trim().slice(0, 2000),
    });
  }
  return items;
}
