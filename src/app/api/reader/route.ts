import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const target = new URL(req.url).searchParams.get("url");
  if (!target) {
    return new Response(JSON.stringify({ error: "no_url" }), { status: 400 });
  }
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return new Response(JSON.stringify({ error: "bad_url" }), { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return new Response(JSON.stringify({ error: "unsupported_protocol" }), {
      status: 400,
    });
  }
  // Block obvious local addresses to prevent SSRF on internal IPs.
  if (
    parsed.hostname === "localhost" ||
    /^127\./.test(parsed.hostname) ||
    /^10\./.test(parsed.hostname) ||
    /^192\.168\./.test(parsed.hostname) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(parsed.hostname) ||
    parsed.hostname === "0.0.0.0"
  ) {
    return new Response(JSON.stringify({ error: "blocked_host" }), {
      status: 400,
    });
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AtlasReader/1.0; +https://atlas.example)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });
    if (!upstream.ok) {
      return Response.json({
        url: parsed.toString(),
        status: upstream.status,
        title: parsed.hostname,
        html: `<p>Upstream returned ${upstream.status}.</p>`,
        text: "",
      });
    }
    const raw = await upstream.text();
    const { title, html, text } = extractReadable(raw, parsed);
    return Response.json({
      url: parsed.toString(),
      status: 200,
      title,
      html,
      text,
    });
  } catch (err) {
    return Response.json({
      url: parsed.toString(),
      status: 502,
      title: parsed.hostname,
      html: `<p>Could not reach the source: ${err instanceof Error ? err.message : String(err)}</p>`,
      text: "",
    });
  }
}

function extractReadable(html: string, base: URL) {
  // Remove scripts/styles/nav/header/footer/aside/forms first.
  const noisy = [
    "script",
    "style",
    "noscript",
    "iframe",
    "form",
    "nav",
    "header",
    "footer",
    "aside",
  ];
  let cleaned = html;
  for (const tag of noisy) {
    cleaned = cleaned.replace(
      new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, "gi"),
      " ",
    );
  }
  // Title
  const titleMatch = cleaned.match(/<title>([\s\S]*?)<\/title>/i);
  const title = (titleMatch?.[1] ?? base.hostname).trim().slice(0, 200);

  // Prefer <article>, <main>, then largest <div>.
  let main =
    pickFirst(cleaned, /<article[\s\S]*?<\/article>/i) ??
    pickFirst(cleaned, /<main[\s\S]*?<\/main>/i);
  if (!main) {
    // pick largest div
    const divs = cleaned.match(/<div[\s\S]*?<\/div>/gi) ?? [];
    divs.sort((a, b) => textOnly(b).length - textOnly(a).length);
    main = divs[0] ?? cleaned;
  }

  const safe = sanitizeHtml(main, base);
  const text = textOnly(main);

  return { title, html: safe, text };
}

function pickFirst(s: string, re: RegExp): string | null {
  const m = s.match(re);
  return m ? m[0] : null;
}

function textOnly(s: string) {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ALLOWED_TAGS = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "ul",
  "ol",
  "li",
  "blockquote",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "a",
  "code",
  "pre",
  "figure",
  "figcaption",
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "div",
  "section",
  "br",
  "hr",
  "span",
]);

const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ["href", "title"],
  img: ["src", "alt", "title"],
};

const BLOCKED_URL_SCHEMES = /^(javascript|data|vbscript|file|about|blob):/i;

function sanitizeHtml(html: string, base: URL): string {
  return html.replace(
    /<\/?([a-z][a-z0-9]*)([^>]*)>/gi,
    (_full, tag: string, attrs: string) => {
      const lower = tag.toLowerCase();
      if (!ALLOWED_TAGS.has(lower)) return "";
      const allowed = ALLOWED_ATTRS[lower] ?? [];
      const cleanedAttrs = (attrs.match(/[a-z-]+\s*=\s*"[^"]*"/gi) ?? [])
        .map((a) => {
          const [name, ...rest] = a.split("=");
          const n = name.trim().toLowerCase();
          if (!allowed.includes(n)) return null;
          // Strip event-handler-like attrs categorically.
          if (n.startsWith("on")) return null;
          let v = rest.join("=").trim().replace(/^"|"$/g, "");
          if (n === "href" || n === "src") {
            // Reject obvious XSS vectors before normalising. Even "data:" URLs
            // can carry HTML payloads that re-introduce scripts on render.
            if (BLOCKED_URL_SCHEMES.test(v.trim())) return null;
            try {
              v = new URL(v, base).toString();
            } catch {
              return null;
            }
            if (!/^https?:\/\//i.test(v)) return null;
          }
          return `${n}="${v.replace(/"/g, "&quot;")}"`;
        })
        .filter(Boolean)
        .join(" ");
      return `<${lower}${cleanedAttrs ? " " + cleanedAttrs : ""}>`;
    },
  );
}
