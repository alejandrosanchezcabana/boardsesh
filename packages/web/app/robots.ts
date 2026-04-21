import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/feed", "/api/", "/auth/", "/settings", "/you", "/you/*"],
    },
    sitemap: "https://www.boardsesh.com/sitemap.xml",
  };
}
