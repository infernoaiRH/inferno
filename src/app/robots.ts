import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// AI crawlers, named so a default block list elsewhere can't shut them out.
const aiCrawlers = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Meta-ExternalAgent",
  "Amazonbot",
  "DuckAssistBot",
  "MistralAI-User",
  "CCBot",
];

/** Everything public is crawlable; APIs aren't, except the status JSON. */
export default function robots(): MetadataRoute.Robots {
  const rule = { allow: ["/", "/api/status", "/llms.txt"], disallow: ["/api/"] };
  return {
    rules: [
      { userAgent: "*", ...rule },
      { userAgent: aiCrawlers, ...rule },
    ],
    sitemap: `${site.url}/sitemap.xml`,
  };
}
