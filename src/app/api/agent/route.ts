import { NextRequest } from "next/server";
import { formatVoiceForPrompt } from "@/lib/voice";

export const runtime = "nodejs";

type Mode = "edit" | "ask" | "plan" | "cite";

interface Body {
  mode: Mode;
  prompt: string;
  selection: string | null;
  documentTitle: string;
  documentHtml: string;
  voice?: any;
  styleNotes?: string;
  requireSources?: boolean;
}

type Provider = "openai" | "anthropic" | "mock";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  const provider = (req.headers.get("x-provider") ?? "openai") as Provider;
  const openaiKey =
    req.headers.get("x-openai-key") || process.env.OPENAI_API_KEY || "";
  const anthropicKey =
    req.headers.get("x-anthropic-key") || process.env.ANTHROPIC_API_KEY || "";
  const niaKey = req.headers.get("x-nia-key") || process.env.NIA_API_KEY || "";
  const venue = req.headers.get("x-venue") ?? "generic";
  const model =
    req.headers.get("x-model") ||
    (provider === "anthropic"
      ? "claude-haiku-4-5-20251001"
      : "gpt-4o-mini");

  const origin = new URL(req.url).origin;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const write = (s: string) => controller.enqueue(encoder.encode(s));
      try {
        // Pre-fetch context relevant to mode (library results for cite, verification hints, etc.)
        let extraContext = "";
        if (body.mode === "cite") {
          const ctx = await gatherCitationContext({
            prompt: body.prompt,
            selection: body.selection,
            niaKey,
            origin,
          });
          extraContext = ctx;
          if (ctx.startsWith("<<<CITATIONS>>>")) {
            // No model required — just stream candidates straight back.
            write(
              "Verified citation candidates ranked by confidence. Click one to insert.\n\n",
            );
            write(ctx);
            controller.close();
            return;
          }
        }
        if (provider === "mock") {
          await mockStream(body, extraContext, write);
          controller.close();
          return;
        }
        if (provider === "anthropic") {
          if (!anthropicKey) {
            write(
              "No Anthropic API key set. Open Settings (⌘,) to add one, or switch to Mock.",
            );
            controller.close();
            return;
          }
          await anthropicStream(body, extraContext, model, anthropicKey, write, venue);
          controller.close();
          return;
        }
        if (!openaiKey) {
          await mockStream(body, extraContext, write);
          controller.close();
          return;
        }
        await openaiStream(body, extraContext, model, openaiKey, write, venue);
        controller.close();
      } catch (err) {
        write(
          `\n\nAtlas hit an error: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function systemPromptFor(body: Body, extraContext: string, venue: string) {
  const voicePrompt = formatVoiceForPrompt(body.voice ?? null);
  const styleNotes = (body.styleNotes ?? "").trim();
  const styleBlock = [voicePrompt, styleNotes ? `# Custom style notes from the author\n${styleNotes}` : ""]
    .filter(Boolean)
    .join("\n\n");
  const sourcesRule = body.requireSources
    ? `\n- For every factual claim in "after" that goes beyond the selection or document, populate "sources[]" with a supporting verbatim quote. If you cannot supply a source, add the claim to "unsupportedClaims[]" and prefer not to introduce that claim at all.`
    : "";
  if (body.mode === "edit") {
    return `You are Atlas, an editor revising academic prose for venue "${venue}".

${styleBlock}

OUTPUT FORMAT (strict):
1. 1-3 short sentences of reasoning to the author.
2. A line containing just <<<JSON>>>.
3. A JSON object:
{
  "after": "<rewrite>",
  "rationale": "<one sentence>",
  "sources": [
    { "label": "<author or short tag>", "quote": "<verbatim supporting quote from the selection, document, or provided context>", "origin": "selection"|"draft"|"library"|"verified", "url": "<optional>", "doi": "<optional>" }
  ],
  "unsupportedClaims": ["<claim text>", ...]
}

Rules:
- Preserve the author's voice, terminology, and citations.
- NEVER invent citations, DOIs, or numbers not present in the selection or context.
- "after" is plain text.${sourcesRule}
- If you have no sources, return "sources": [].`;
  }
  if (body.mode === "plan") {
    return `You are Atlas, a research co-author. The user wants a multi-step edit PLAN for their draft. Do NOT rewrite the document directly.

OUTPUT FORMAT (strict):
1. 1-2 short sentences naming the overall goal.
2. A line containing just <<<PLAN>>>.
3. A JSON object:
{
  "goal": "<one sentence>",
  "steps": [
    {
      "id": "s1",
      "section": "<section heading>",
      "action": "rewrite"|"insert"|"delete"|"cite"|"comment",
      "targetQuote": "<short verbatim quote from the draft>",
      "why": "<reason in ≤20 words>",
      "draft": "<proposed new text for that step (plain text)>"
    }
  ]
}

Rules:
- 3-7 steps maximum.
- targetQuote MUST be a real substring of the document.
- Each step should be independently approvable. The user will accept/reject per step.
- Order steps from highest leverage to lowest.
- Never auto-apply.`;
  }
  if (body.mode === "cite") {
    return `You are Atlas, a research librarian. Recommend 2-4 verified-looking citations for the user's claim, in the user's existing citation style.

If the context below contains candidate references with DOIs/years, prefer those. NEVER invent a DOI or year. If unsure, say "no verified match".

OUTPUT FORMAT (strict):
1. 1-2 sentences explaining the recommendation.
2. A line containing just <<<JSON>>>.
3. A JSON object: {"candidates":[{"title":"...","authors":["..."],"year":2024,"doi":"...","url":"..."}]}

Rules:
- 1-4 candidates max.
- If no verified match, return {"candidates":[]} and explain why.`;
  }
  return `You are Atlas, a research co-author for venue "${venue}". Answer the user's question about their paper. Be concise and concrete. Cite by section when useful. Do NOT include the <<<JSON>>> marker.

${voicePrompt}`;
}

function userContentFor(body: Body, extraContext: string) {
  const docPlain = htmlToText(body.documentHtml).slice(0, 12000);
  const parts = [`# Paper title\n${body.documentTitle}`];
  if (body.selection) parts.push(`# Selected passage\n${body.selection}`);
  parts.push(`# Full draft (truncated)\n${docPlain}`);
  if (extraContext) parts.push(`# Verified context from the user's library + web\n${extraContext}`);
  parts.push(`# Instruction\n${body.prompt}`);
  return parts.join("\n\n");
}

async function gatherCitationContext({
  prompt,
  selection,
  niaKey,
  origin,
}: {
  prompt: string;
  selection: string | null;
  niaKey: string;
  origin: string;
}) {
  const query = (selection || prompt || "").slice(0, 400);
  try {
    const r = await fetch(`${origin}/api/verify-citation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(niaKey ? { "x-nia-key": niaKey } : {}),
      },
      body: JSON.stringify({ query }),
      // Don't let a slow verify path hang the whole agent stream.
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return "";
    const data = (await r.json()) as any;
    const cands = (data.candidates ?? []).slice(0, 6);
    if (!cands.length) return "";
    // If at least one candidate is well-resolved, stream candidates direct.
    if (cands[0]?.confidence >= 0.6) {
      return (
        "<<<CITATIONS>>>" +
        JSON.stringify({
          candidates: cands.map((c: any) => ({
            title: c.title,
            authors: c.authors,
            year: c.year,
            doi: c.doi,
            url: c.url,
            source: c.source,
            confidence: c.confidence,
            snippet: c.snippet ?? null,
          })),
        })
      );
    }
    return cands
      .map(
        (c: any, i: number) =>
          `[${i + 1}] ${c.title} — ${c.authors.slice(0, 3).join(", ")} (${c.year ?? "?"}). DOI: ${c.doi ?? "—"}. URL: ${c.url}. via ${c.source}`,
      )
      .join("\n");
  } catch {
    return "";
  }
}

async function openaiStream(
  body: Body,
  extraContext: string,
  model: string,
  key: string,
  write: (s: string) => void,
  venue: string,
) {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPromptFor(body, extraContext, venue) },
        { role: "user", content: userContentFor(body, extraContext) },
      ],
    }),
  });
  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => "");
    write(
      `OpenAI returned ${resp.status}. ${text.slice(0, 240)}\n\nIf this looks like a key/quota error, open Settings (⌘,) and check your key.`,
    );
    return;
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content ?? "";
        if (delta) write(delta);
      } catch {}
    }
  }
}

async function anthropicStream(
  body: Body,
  extraContext: string,
  model: string,
  key: string,
  write: (s: string) => void,
  venue: string,
) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      stream: true,
      temperature: 0.4,
      system: systemPromptFor(body, extraContext, venue),
      messages: [{ role: "user", content: userContentFor(body, extraContext) }],
    }),
  });
  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => "");
    write(
      `Anthropic returned ${resp.status}. ${text.slice(0, 240)}\n\nIf this looks like a key/quota error, open Settings (⌘,) and check your key.`,
    );
    return;
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const events = buf.split("\n\n");
    buf = events.pop() ?? "";
    for (const ev of events) {
      const dataLine = ev.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const payload = dataLine.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        if (
          json.type === "content_block_delta" &&
          json.delta?.type === "text_delta"
        ) {
          write(json.delta.text ?? "");
        }
      } catch {}
    }
  }
}

async function mockStream(
  body: Body,
  extraContext: string,
  write: (s: string) => void,
) {
  if (body.mode === "edit" && body.selection) {
    const intro = `Tightening this passage. I'll keep your terminology and the core claim, but cut throat-clearing and merge the second clause.`;
    for (const w of intro.split(" ")) {
      write(w + " ");
      await sleep(15);
    }
    write("\n\n<<<JSON>>>");
    write(
      JSON.stringify({
        after: mockRewrite(body.selection, body.prompt),
        rationale:
          "Removed filler and merged clauses while preserving the claim.",
      }),
    );
    return;
  }
  if (body.mode === "plan") {
    const intro = `Here's a 4-step plan to strengthen this section.`;
    for (const w of intro.split(" ")) {
      write(w + " ");
      await sleep(12);
    }
    write("\n\n<<<PLAN>>>");
    write(
      JSON.stringify({
        goal: "Tighten the abstract and shore up the rigor of the evaluation.",
        steps: [
          {
            id: "s1",
            section: "Abstract",
            action: "rewrite",
            targetQuote: "Retrieval-augmented generation",
            why: "Lead with the result, not the field.",
            draft:
              "AtlasRAG, a long-context RAG pipeline, improves exact-match accuracy by 11.4 points over a strong dense baseline and cuts hallucinated citations by 38% on a new 4,200-question scientific QA benchmark.",
          },
          {
            id: "s2",
            section: "4. Experiments",
            action: "insert",
            targetQuote: "AtlasRAG achieves 71.3%",
            why: "Add confidence intervals so reviewers don't flag the headline as noisy.",
            draft: "AtlasRAG achieves 71.3% (95% CI 70.1–72.5) exact-match accuracy",
          },
          {
            id: "s3",
            section: "5. Limitations",
            action: "rewrite",
            targetQuote: "AtlasRAG inherits the biases",
            why: "Make the limitations section honest and venue-appropriate.",
            draft:
              "AtlasRAG inherits the biases of its retrieval index, does not model figures or equations as first-class evidence, and is monolingual; we did not evaluate on adversarial questions.",
          },
          {
            id: "s4",
            section: "2. Related Work",
            action: "cite",
            targetQuote: "Specter and SciNCL",
            why: "Two recent retrieval-aware long-context papers are missing.",
            draft:
              "Add citations to (Liu et al., 2024 — RetroLM) and (Yen et al., 2025 — LongRetrieve) alongside Specter and SciNCL.",
          },
        ],
      }),
    );
    return;
  }
  if (body.mode === "cite") {
    const intro = `Here are unverified mock candidates. Add a Nia or OpenAI key for verified suggestions.`;
    for (const w of intro.split(" ")) {
      write(w + " ");
      await sleep(12);
    }
    write("\n\n<<<JSON>>>");
    write(
      JSON.stringify({
        candidates: [
          {
            title: "Mock canonical reference",
            authors: ["A. Author"],
            year: 2024,
            doi: null,
            url: "",
          },
        ],
      }),
    );
    return;
  }
  const reply = body.mode === "edit"
    ? `Highlight a passage in the editor first — I'll edit it in place once you do.`
    : `Running on the mock provider. Open Settings (⌘,) to add an OpenAI or Anthropic key for real answers.`;
  for (const w of reply.split(" ")) {
    write(w + " ");
    await sleep(18);
  }
}

function mockRewrite(input: string, prompt: string) {
  const want = prompt.toLowerCase();
  let out = input.replace(/\s+/g, " ").trim();
  if (want.includes("short") || want.includes("tighten")) {
    out = out
      .replace(/\bin order to\b/gi, "to")
      .replace(/\bdue to the fact that\b/gi, "because")
      .replace(/\butilize\b/gi, "use")
      .replace(/\bvery\b\s+/gi, "")
      .replace(/\b(?:essentially|basically|actually|really)\b\s*/gi, "");
    const sentences = out.split(/(?<=[.!?])\s+/);
    out = sentences
      .slice(0, Math.max(1, Math.ceil(sentences.length * 0.7)))
      .join(" ");
  } else if (want.includes("plain")) {
    out = "In short, " + out;
  } else if (want.includes("citation")) {
    out = out + " [unverified citation]";
  } else if (want.includes("rigor")) {
    out = out
      .replace(/\bshow(s|ed)?\b/gi, "suggest$1")
      .replace(/\balways\b/gi, "in our experiments");
  }
  return out;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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
