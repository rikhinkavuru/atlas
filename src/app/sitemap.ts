import type { MetadataRoute } from "next";

const BASE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://atlas.example";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1.0, changeFrequency: "weekly" },
    { path: "/app", priority: 0.9, changeFrequency: "daily" },
    { path: "/pricing", priority: 0.8, changeFrequency: "monthly" },
    { path: "/docs", priority: 0.8, changeFrequency: "weekly" },
    { path: "/changelog", priority: 0.7, changeFrequency: "weekly" },
    { path: "/roadmap", priority: 0.7, changeFrequency: "weekly" },
    { path: "/verify", priority: 0.7, changeFrequency: "monthly" },
    { path: "/for-reviewers", priority: 0.7, changeFrequency: "monthly" },
    { path: "/reviewer-model", priority: 0.6, changeFrequency: "monthly" },
    { path: "/security", priority: 0.5, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.5, changeFrequency: "monthly" },
    { path: "/sign-in", priority: 0.4, changeFrequency: "yearly" },
    { path: "/sign-up", priority: 0.4, changeFrequency: "yearly" },
  ];
  return pages.map((p) => ({
    url: `${BASE}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
