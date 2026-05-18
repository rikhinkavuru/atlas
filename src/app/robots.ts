import type { MetadataRoute } from "next";

const BASE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://atlas.example";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The actual signed-in workspace state isn't useful for search;
        // keep the public pages discoverable and let /app render its
        // public shell for crawlers.
        disallow: ["/api/", "/sign-in/", "/sign-up/"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
