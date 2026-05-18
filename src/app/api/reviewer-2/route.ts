import { NextRequest } from "next/server";
import type { AnalysisReport } from "@/types";
import {
  deriveReviewer2Questions,
  type Reviewer2Bundle,
  type Reviewer2Question,
} from "@/lib/reviewer2";
import {
  formatRubricForPrompt,
  rubricForVenue,
  type VenueId,
} from "@/lib/rubrics";

export const runtime = "nodejs";

type Provider = "openai" | "anthropic" | "mock";

interface PostBody {
  title: string;
  html: string;
  report: AnalysisReport;
}

/**
 * Predict 3–5 questions the venue's most-feared reviewer is likely to raise on
 * this paper. Always returns the heuristic baseline (instant, offline). When a
 * provider key is set we additionally call the LLM with a venue-tuned prompt
 * to refine and venue-flavour the list — useful, not load-bearing.
 */
export async function POST(req: NextRequest) {
  const { title, html, report } = (await req.json()) as PostBody;
  const provider = (req.headers.get("x-provider") ?? "openai") as Provider;
  const venue = (req.headers.get("x-venue") ?? "generic") as VenueId;
  const openaiKey =
    req.headers.get("x-openai-key") || process.env.OPENAI_API_KEY || "";
  const anthropicKey =
    req.headers.get("x-anthropic-key") || process.env.ANTHROPIC_API_KEY || "";
  const model =
    req.headers.get("x-model") ||
    (provider === "anthropic"
      ? "claude-haiku-4-5-20251001"
      : "gpt-4o-mini");

  const baseline = deriveReviewer2Questions(venue, report);

  // Best-effort LLM refinement. If anything fails the baseline still ships.
  let refined: Reviewer2Question[] | undefined;
  let refinedBy: string | undefined;
  try {
    if (provider === "openai" && openaiKey) {
      refined = await callOpenAI(
        venue,
        title,
        html,
        baseline,
        model,
        openaiKey,
      );
      if (refined) refinedBy = `openai · ${model}`;
    } else if (provider === "anthropic" && anthropicKey) {
      refined = await callAnthropic(
        venue,
        title,
        html,
        baseline,
        model,
        anthropicKey,
      );
      if (refined) refinedBy = `anthropic · ${model}`;
    }
  } catch {
    refined = undefined;
  }

  const bundle: Reviewer2Bundle = {
    baseline,
    refined,
    refinedBy,
    generatedAt: Date.now(),
  };
  return Response.json(bundle);
}

function systemPrompt(venue: VenueId) {
  const rubric = rubricForVenue(venue);
  return `You are simulating "Reviewer 2" at ${rubric.name} — the strictest reviewer the paper is likely to draw. Your job is to predict the 3–5 questions this reviewer will raise. Be specific, venue-aware, and avoid generic complaints.

${formatRubricForPrompt(rubric)}

Return JSON ONLY with the shape:
{
  "questions": [
    {
      "id": "<short slug>",
      "question": "<one-sentence reviewer question, written in first person reviewer voice>",
      "concern": "<short label for the issue>",
      "severity": "watch" | "concern" | "blocker",
      "rebuttalDraft": "<2-3 sentences the authors can use as a rebuttal starting point>",
      "evidence": "<verbatim quote from the draft if you can find one, otherwise omit>"
    }
  ]
}

Rules:
- 3 questions minimum, 5 maximum.
- "blocker" only when the question would lead Reviewer 2 to vote reject.
- "rebuttalDraft" should sound like a co-author talking to a reviewer, not marketing copy.
- Reference the paper's actual content — pull quotes when you can.
- No commentary outside the JSON. No code fences.`;
}

function userPrompt(
  title: string,
  html: string,
  baseline: Reviewer2Question[],
): string {
  const text = htmlToText(html).slice(0, 9000);
  const baselineSummary = baseline
    .map((q) => `- [${q.severity}] ${q.question} (${q.concern})`)
    .join("\n");
  return `Title: ${title}

Draft (truncated):
${text}

Heuristic baseline (use as a starting point — refine, replace weaker ones, keep what's good):
${baselineSummary}`;
}

async function callOpenAI(
  venue: VenueId,
  title: string,
  html: string,
  baseline: Reviewer2Question[],
  model: string,
  key: string,
): Promise<Reviewer2Question[] | undefined> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt(venue) },
        { role: "user", content: userPrompt(title, html, baseline) },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!resp.ok) return undefined;
  const data = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return parseQuestions(data.choices?.[0]?.message?.content ?? "{}");
}

async function callAnthropic(
  venue: VenueId,
  title: string,
  html: string,
  baseline: Reviewer2Question[],
  model: string,
  key: string,
): Promise<Reviewer2Question[] | undefined> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1800,
      temperature: 0.4,
      system:
        systemPrompt(venue) +
        "\n\nReturn ONLY the JSON object — no prose, no code fences.",
      messages: [
        { role: "user", content: userPrompt(title, html, baseline) },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!resp.ok) return undefined;
  const data = (await resp.json()) as {
    content?: { type: string; text?: string }[];
  };
  return parseQuestions(data.content?.[0]?.text ?? "{}");
}

function parseQuestions(raw: string): Reviewer2Question[] | undefined {
  try {
    let cleaned = raw.trim();
    const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) cleaned = fence[1].trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) cleaned = cleaned.slice(start, end + 1);
    const parsed = JSON.parse(cleaned);
    const list = Array.isArray(parsed.questions) ? parsed.questions : [];
    return list
      .filter(
        (q: Partial<Reviewer2Question>) =>
          typeof q.question === "string" &&
          typeof q.concern === "string" &&
          typeof q.rebuttalDraft === "string",
      )
      .map((q: Partial<Reviewer2Question>, i: number) => ({
        id: q.id ?? `q_llm_${i}`,
        question: q.question!,
        concern: q.concern!,
        severity:
          q.severity === "blocker" || q.severity === "concern"
            ? q.severity
            : "watch",
        rebuttalDraft: q.rebuttalDraft!,
        evidence: q.evidence,
      }))
      .slice(0, 5);
  } catch {
    return undefined;
  }
}

function htmlToText(html: string): string {
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
