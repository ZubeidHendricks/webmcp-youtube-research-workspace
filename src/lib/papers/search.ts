import "server-only";
import type { PaperResult } from "./types";

/**
 * arXiv search and metadata.
 *
 * The public API needs no key and imposes no quota worth pooling, so unlike the
 * YouTube path this is a plain fetch. arXiv asks for one request at a time and a
 * descriptive user agent.
 */
const API = "https://export.arxiv.org/api/query";
const HEADERS = { "user-agent": "YouGo/1.0 (research workspace; +https://yougo.k53.tech)" };

function textBetween(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match ? decode(match[1]) : "";
}

function decode(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseEntries(xml: string): PaperResult[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];

  return entries.flatMap((entry): PaperResult[] => {
    const idMatch = entry.match(/<id>https?:\/\/arxiv\.org\/abs\/([^<]+)<\/id>/);
    if (!idMatch) return [];
    const sourceId = idMatch[1].replace(/v\d+$/, "");

    const authors = (entry.match(/<name>([^<]*)<\/name>/g) ?? [])
      .map((name) => decode(name))
      .slice(0, 8);

    return [
      {
        sourceId,
        title: textBetween(entry, "title") || "Untitled",
        authors,
        published: textBetween(entry, "published").slice(0, 10),
        summary: textBetween(entry, "summary"),
        url: `https://arxiv.org/abs/${sourceId}`,
      },
    ];
  });
}

/**
 * Builds the arXiv query.
 *
 * Quoting the whole phrase makes arXiv match it exactly, which returns nothing
 * for a natural-language topic. Requiring every term with AND is the opposite
 * problem — "tool use in language model agents" then matches almost nothing.
 * The unquoted form lets arXiv rank by relevance, which is what a researcher
 * typing a topic actually wants.
 */
function buildQuery(query: string): string {
  const cleaned = query.replace(/["()]/g, " ").replace(/\s+/g, " ").trim();
  return `all:${cleaned}`;
}

export async function searchPapers(query: string, maxResults = 8): Promise<PaperResult[]> {
  const params = new URLSearchParams({
    search_query: buildQuery(query),
    max_results: String(Math.min(Math.max(maxResults, 1), 25)),
    sortBy: "relevance",
  });

  const response = await fetch(`${API}?${params}`, { headers: HEADERS });
  if (!response.ok) throw new Error(`arXiv search failed (${response.status}).`);
  return parseEntries(await response.text());
}

export async function getPaper(sourceId: string): Promise<PaperResult | null> {
  const response = await fetch(`${API}?id_list=${encodeURIComponent(sourceId)}`, {
    headers: HEADERS,
  });
  if (!response.ok) throw new Error(`arXiv lookup failed (${response.status}).`);
  return parseEntries(await response.text())[0] ?? null;
}
