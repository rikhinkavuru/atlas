import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Atlas — Cursor for research papers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0a0a0a",
          color: "#f5f5f5",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "72px",
          position: "relative",
        }}
      >
        {/* Grid backdrop */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(to bottom, transparent, #0a0a0a 70%), repeating-linear-gradient(0deg, #1c1c1c 0 1px, transparent 1px 84px), repeating-linear-gradient(90deg, #1c1c1c 0 1px, transparent 1px 84px)",
            opacity: 0.35,
          }}
        />
        {/* Glow */}
        <div
          style={{
            position: "absolute",
            top: -200,
            left: "50%",
            transform: "translateX(-50%)",
            width: 1200,
            height: 600,
            background:
              "radial-gradient(ellipse at center, rgba(198,242,78,0.22), transparent 70%)",
            filter: "blur(60px)",
          }}
        />

        {/* Header row: wordmark on the left, live Trust Meter on the right.
            The badge is the social-share version of the in-app Trust Meter —
            sourced/unsourced ratio + chain-signed shield. Numbers are baked
            in for the sample paper since OG render is pure SSR and ledgers
            live in localStorage. Per-paper share URLs would need a server
            shareKey route — deferred. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            zIndex: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: "#c6f24e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0a0a0a",
                fontWeight: 700,
                fontSize: 22,
                fontFamily: "ui-monospace, Menlo, monospace",
              }}
            >
              ◢◣
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                lineHeight: 1,
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 22, letterSpacing: -0.4 }}>
                ATLAS
              </span>
              <span
                style={{
                  fontSize: 12,
                  letterSpacing: 4,
                  color: "#6b6b6b",
                  marginTop: 4,
                  fontFamily: "ui-monospace, Menlo, monospace",
                }}
              >
                PAPER STUDIO
              </span>
            </div>
          </div>

          {/* Trust Meter chip */}
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 16px",
              border: "1px solid rgba(198,242,78,0.35)",
              background: "rgba(198,242,78,0.06)",
              borderRadius: 999,
              fontFamily: "ui-monospace, Menlo, monospace",
              color: "#c6f24e",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 20,
                height: 20,
                borderRadius: 999,
                background: "#c6f24e",
                color: "#0a0a0a",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              ✓
            </div>
            <span
              style={{
                fontSize: 18,
                letterSpacing: 1.2,
                fontWeight: 600,
              }}
            >
              100% TRUSTED
            </span>
            <span
              style={{
                fontSize: 12,
                color: "#a1a1a1",
                letterSpacing: 1.4,
              }}
            >
              · CHAIN SIGNED
            </span>
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            marginTop: 80,
            display: "flex",
            flexDirection: "column",
            zIndex: 1,
          }}
        >
          <div
            style={{
              fontSize: 96,
              fontWeight: 600,
              letterSpacing: -3.2,
              lineHeight: 1.02,
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <span>Cursor for</span>
            <span
              style={{
                fontStyle: "italic",
                color: "#c6f24e",
                fontFamily: "ui-serif, Georgia, serif",
              }}
            >
              research papers.
            </span>
          </div>
          <div
            style={{
              marginTop: 36,
              fontSize: 26,
              color: "#a1a1a1",
              lineHeight: 1.4,
              maxWidth: 880,
            }}
          >
            Read PDFs. Draft with an agent that cites real sources. Grade
            against your venue&apos;s rubric. Respond to Reviewer 2.
          </div>
        </div>

        {/* Footer strip */}
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            gap: 22,
            color: "#6b6b6b",
            fontSize: 18,
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "#c6f24e",
              fontFamily: "ui-monospace, Menlo, monospace",
              fontSize: 14,
              letterSpacing: 3,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "#c6f24e",
              }}
            />
            PROVENANCE LEDGER · VENUE CRITIC · REPRODUCIBILITY SPINE
          </div>
          <div style={{ marginLeft: "auto", fontSize: 18, color: "#a1a1a1" }}>
            atlas.app
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
