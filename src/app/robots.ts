import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/", "/profile/", "/studio/"],
    },
    sitemap: "https://icomics.uz/sitemap.xml",
  };
}
