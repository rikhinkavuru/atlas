import { NextRequest } from "next/server";
import type {
  AnalysisIssue,
  AnalysisReport,
  RubricScore,
} from "@/types";
import {
  formatRubricForPrompt,
  rubricForVenue,
  type VenueId,
} from "@/lib/rubrics";

export const runtime = "nodejs";

type Provider = "openai" | "anthropic" | "mock";

function systemPrompt(rubric: ReturnType<typeof rubricForVenue>) {
  return `You are Atlas, an expert peer-reviewer. You review research-paper drafts against the explicit rubric below. Be specific, evidence-based, and never invent quotes.

${formatRubricForPrompt(rubric)}

Respond with a single JSON object:
{
  "summary": "<2-3 sentence overall verdict, signed off as Reviewer 2 at the named venue>",
  "scores": [
    {
      "name": "<dimension name from the rubric>",
      "score": <0..1>,
      "note": "<one sentence justification>",
      "criteria": ["<rubric criterion that drove this score>", ...],
      "evidence": ["<short verbatim quote from the draft that supports the score>", ...]
    }
  ],
  "issues": [
    {
      "severity": "info"|"suggestion"|"warning"|"error",
      "category": "<dimension name>",
      "section": "<best-guess section like 'Abstract' or '3.2 Method'>",
      "quote": "<verbatim quote from the draft, <=200 chars>",
      "message": "<what the reviewer would say>",
      "suggestion": "<concrete fix, optional>",
      "rubricCriterion": "<the rubric line being checked>"
    }
  ]
}

Rules:
- Use the exact dimension names from the rubric for both "scores[].name" and "issues[].category".
- "quote" and "evidence" entries must be real substrings of the draft.
- Find 8-14 issues spanning multiple dimensions.
- Prefer "suggestion" severity unless there is a real factual/methodological problem.
- No commentary outside the JSON. No code fences.`;
}

export async function POST(req: NextRequest) {
  const { title, html } = (await req.json()) as { title: string; html: string };
  const provider = (req.headers.get("x-provider") ?? "openai") as Provider;
  const openaiKey =
    req.headers.get("x-openai-key") || process.env.OPENAI_API_KEY || "";
  const anthropicKey =
    req.headers.get("x-anthropic-key") || process.env.ANTHROPIC_API_KEY || "";
  const model =
    req.headers.get("x-model") ||
    (provider === "anthropic"
      ? "claude-haiku-4-5-20251001"
      : "gpt-4o-mini");
  const venue = (req.headers.get("x-venue") ?? "generic") as VenueId;
  const rubric = rubricForVenue(venue);

  const text = htmlToText(html).slice(0, 14000);
  const userMsg = `Title: ${title}\n\nDraft:\n${text}`;

  try {
    let report: AnalysisReport | null = null;
    if (provider === "openai" && openaiKey) {
      report = await callOpenAI(systemPrompt(rubric), model, openaiKey, userMsg);
    } else if (provider === "anthropic" && anthropicKey) {
      report = await callAnthropic(
        systemPrompt(rubric),
        model,
        anthropicKey,
        userMsg,
      );
    }
    if (!report) report = heuristicReport(text, rubric);
    report.venue = rubric.name;
    return Response.json(report);
  } catch {
    const fallback = heuristicReport(text, rubric);
    fallback.venue = rubric.name;
    return Response.json(fallback);
  }
}

async function callOpenAI(
  systemPrompt: string,
  model: string,
  key: string,
  userMsg: string,
): Promise<AnalysisReport | null> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
      ],
    }),
  });
  if (!resp.ok) return null;
  const data = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return parseReport(data.choices?.[0]?.message?.content ?? "{}");
}

async function callAnthropic(
  systemPrompt: string,
  model: string,
  key: string,
  userMsg: string,
): Promise<AnalysisReport | null> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      temperature: 0.2,
      system: systemPrompt + "\n\nReturn ONLY the JSON object.",
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  if (!resp.ok) return null;
  const data = (await resp.json()) as {
    content?: { type: string; text?: string }[];
  };
  return parseReport(data.content?.[0]?.text ?? "{}");
}

function parseReport(raw: string): AnalysisReport | null {
  try {
    let cleaned = raw.trim();
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) cleaned = fenceMatch[1].trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) cleaned = cleaned.slice(start, end + 1);
    const parsed = JSON.parse(cleaned);
    const issues: AnalysisIssue[] = (parsed.issues ?? []).map(
      (i: AnalysisIssue, idx: number) => ({ ...i, id: `i_${idx}` }),
    );
    const scores: RubricScore[] = (parsed.scores ?? []).map(
      (s: RubricScore) => ({
        ...s,
        score: Math.max(0, Math.min(1, Number(s.score) || 0)),
      }),
    );
    return {
      summary: parsed.summary ?? "",
      scores,
      issues,
      generatedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

function heuristicReport(
  text: string,
  rubric: ReturnType<typeof rubricForVenue>,
): AnalysisReport {
  const issues: AnalysisIssue[] = [];
  const paragraphs = text.split(/\n+/).filter((p) => p.length > 60);
  const wordy =
    /\b(?:in order to|due to the fact that|the fact that|utilize|essentially|basically|actually|really|very)\b/i;
  const passive = /\b(?:was|were|is|are|been|being)\b\s+\b\w+ed\b/i;

  const sectionFor = (i: number) => {
    const headings = text.match(/^(?:\d+\.\s*)?[A-Z][A-Za-z ]+$/gm) ?? [];
    return headings[Math.min(i, headings.length - 1)] ?? "Body";
  };

  const clarityCat = rubric.dimensions.find((d) =>
    d.name.toLowerCase().includes("clarity"),
  )?.name ?? "Clarity";
  const rigorCat = rubric.dimensions.find((d) =>
    /rigor|method|soundness/i.test(d.name),
  )?.name ?? "Rigor";
  const citeCat = rubric.dimensions.find((d) =>
    d.name.toLowerCase().includes("citation"),
  )?.name ?? "Citations";

  paragraphs.slice(0, 24).forEach((p, idx) => {
    if (wordy.test(p) && issues.length < 8) {
      issues.push({
        id: `i_${issues.length}`,
        severity: "suggestion",
        category: clarityCat,
        section: sectionFor(idx),
        quote: p.slice(0, 200),
        message: "Wordy phrasing; cutting filler will tighten the prose.",
        suggestion:
          "Replace 'in order to' → 'to', 'utilize' → 'use', drop intensifiers.",
        rubricCriterion:
          "Sentences are direct and avoid filler ('in order to', 'utilize', 'very').",
      });
    }
    if (passive.test(p) && issues.length < 12) {
      issues.push({
        id: `i_${issues.length}`,
        severity: "info",
        category: clarityCat,
        section: sectionFor(idx),
        quote: p.slice(0, 200),
        message: "Passive construction. Active voice is usually clearer.",
        rubricCriterion: "Each paragraph has a single, identifiable claim.",
      });
    }
  });

  if (!/abstract/i.test(text)) {
    issues.push({
      id: `i_${issues.length}`,
      severity: "warning",
      category: "Structure",
      section: "Top",
      quote: text.slice(0, 200),
      message: "No abstract detected.",
      suggestion: "Add a 6-10 sentence abstract.",
      rubricCriterion:
        "There is an abstract, introduction, methods, results, discussion, limitations, conclusion.",
    });
  }
  if (!/limit/i.test(text)) {
    issues.push({
      id: `i_${issues.length}`,
      severity: "warning",
      category: rigorCat,
      section: "End",
      quote: text.slice(-200),
      message: "No explicit limitations section.",
      suggestion: "Add a paragraph discussing weaknesses honestly.",
      rubricCriterion:
        "Failure modes and threats to validity are named explicitly.",
    });
  }
  if (!/(et al\.|\[\d+\])/.test(text)) {
    issues.push({
      id: `i_${issues.length}`,
      severity: "warning",
      category: citeCat,
      section: "Body",
      quote: paragraphs[1]?.slice(0, 200) ?? "",
      message: "No citations detected in the draft.",
      suggestion: "Cite primary sources for every non-trivial claim.",
      rubricCriterion: "Non-trivial claims are cited.",
    });
  }

  const scores: RubricScore[] = rubric.dimensions.map((d) => ({
    name: d.name,
    score:
      d.name.toLowerCase().includes("citation") &&
      !/(et al\.|\[\d+\])/.test(text)
        ? 0.3
        : 0.7,
    note: "Heuristic score — enable an API key for a rubric-graded review.",
    criteria: d.criteria.slice(0, 2),
    evidence: [paragraphs[0]?.slice(0, 160) ?? ""],
  }));

  return {
    summary:
      "Heuristic review (no API key). Add an OpenAI or Anthropic key in Settings (⌘,) for a rubric-graded critique.",
    scores,
    issues,
    generatedAt: Date.now(),
  };
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
