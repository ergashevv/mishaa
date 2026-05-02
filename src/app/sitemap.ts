import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://icomics.uz";
  
  const routes = [
    "",
    "/about",
    "/contact",
    "/faq",
    "/gallery",
    "/library",
    "/privacy",
    "/story",
    "/support",
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "daily" : "monthly",
    priority: route === "" ? 1 : 0.8,
  }));
}
