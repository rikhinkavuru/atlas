/**
 * Thin client for the local Ollama daemon. Atlas treats Ollama as a
 * fourth provider so users with no API key (and no money for tokens) can
 * still run AI features against a model they pulled locally.
 *
 * The daemon is expected at `${url}/api/chat` (Ollama's native endpoint;
 * not the /v1 OpenAI-compatible shim — we use native because it's been
 * stable across Ollama versions since 0.1.30 and doesn't depend on the
 * shim being enabled).
 *
 * Request shape: { model, messages: [{role, content}], stream, options }
 * Streaming response: newline-delimited JSON, one chunk per token group:
 *   {"model":"...","message":{"role":"assistant","content":"..."},"done":false}
 *   ...
 *   {"done":true,"total_duration":...,"eval_count":...}
 *
 * Non-streaming returns a single JSON object with `.message.content`.
 *
 * Errors surface as { error: "..." } with a non-200 status. We bubble
 * those up so the caller can show the user something actionable like
 * "model not pulled" or "daemon not running".
 */

export interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
  };
  format?: "json";
}

interface OllamaChunk {
  message?: { role: string; content: string };
  done?: boolean;
  error?: string;
}

const DEFAULT_URL = "http://localhost:11434";

function endpoint(url: string | undefined): string {
  const base = (url || DEFAULT_URL).replace(/\/+$/, "");
  return `${base}/api/chat`;
}

/** One-shot, non-streaming call. Returns the full assistant text. */
export async function ollamaChat({
  url,
  model,
  messages,
  temperature = 0.4,
  jsonMode = false,
}: {
  url: string | undefined;
  model: string;
  messages: OllamaMessage[];
  temperature?: number;
  jsonMode?: boolean;
}): Promise<string> {
  const body: OllamaChatRequest = {
    model,
    messages,
    stream: false,
    options: { temperature },
  };
  if (jsonMode) body.format = "json";
  let res: Response;
  try {
    res = await fetch(endpoint(url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(
      `Could not reach Ollama at ${url || DEFAULT_URL}. Is the daemon running? (${err instanceof Error ? err.message : String(err)})`,
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Ollama returned ${res.status}: ${text.slice(0, 400) || res.statusText}`,
    );
  }
  const data = (await res.json()) as OllamaChunk;
  if (data.error) throw new Error(`Ollama error: ${data.error}`);
  return data.message?.content ?? "";
}

/** Streaming call. Invokes `onText(chunk)` for each token batch as it
 *  arrives. Resolves when the daemon emits done:true (or the stream ends). */
export async function ollamaChatStream({
  url,
  model,
  messages,
  temperature = 0.4,
  onText,
}: {
  url: string | undefined;
  model: string;
  messages: OllamaMessage[];
  temperature?: number;
  onText: (chunk: string) => void;
}): Promise<void> {
  const body: OllamaChatRequest = {
    model,
    messages,
    stream: true,
    options: { temperature },
  };
  let res: Response;
  try {
    res = await fetch(endpoint(url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(
      `Could not reach Ollama at ${url || DEFAULT_URL}. Is the daemon running? Run \`ollama serve\` then \`ollama pull ${model}\`. (${err instanceof Error ? err.message : String(err)})`,
    );
  }
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Ollama returned ${res.status}: ${text.slice(0, 400) || res.statusText}`,
    );
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    // Ollama emits one JSON object per line; consume any complete lines.
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let chunk: OllamaChunk;
      try {
        chunk = JSON.parse(line) as OllamaChunk;
      } catch {
        continue;
      }
      if (chunk.error) throw new Error(`Ollama error: ${chunk.error}`);
      const piece = chunk.message?.content;
      if (piece) onText(piece);
      if (chunk.done) return;
    }
  }
  // Flush any trailing JSON (no terminating newline).
  const tail = buf.trim();
  if (tail) {
    try {
      const chunk = JSON.parse(tail) as OllamaChunk;
      if (chunk.message?.content) onText(chunk.message.content);
    } catch {
      /* ignore trailing garbage */
    }
  }
}

/** Verify the daemon is reachable and the requested model is pulled.
 *  Returns null on success or a human-readable error string. */
export async function probeOllama({
  url,
  model,
}: {
  url: string | undefined;
  model: string;
}): Promise<string | null> {
  const base = (url || DEFAULT_URL).replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/api/tags`, { method: "GET" });
    if (!res.ok)
      return `Ollama at ${base} responded ${res.status}. Is the daemon running?`;
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    const names = (data.models ?? []).map((m) => m.name);
    if (names.length === 0)
      return `Ollama is running but no models are pulled. Run: ollama pull ${model}`;
    const has = names.some(
      (n) => n === model || n.startsWith(`${model}:`) || n === `${model}:latest`,
    );
    if (!has)
      return `Ollama is running but model "${model}" isn't pulled. Run: ollama pull ${model}. Available: ${names.slice(0, 4).join(", ")}${names.length > 4 ? ", …" : ""}`;
    return null;
  } catch (err) {
    return `Could not reach Ollama at ${base}. Run \`ollama serve\` first. (${err instanceof Error ? err.message : String(err)})`;
  }
}
