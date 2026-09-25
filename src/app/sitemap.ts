import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

const pages = ["/", "/chat", "/lend", "/network", "/messages", "/credits", "/status"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return pages.map((p) => ({
    url: p === "/" ? site.url : `${site.url}${p}`,
    lastModified: now,
    changeFrequency: p === "/status" ? "always" : "weekly",
    priority: p === "/" ? 1 : 0.7,
  }));
}
