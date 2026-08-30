import "server-only";
import type { Passage } from "./types";
import { fallbackReaderUrl, readerUrl } from "./types";

export class FullTextUnavailableError extends Error {
  constructor(sourceId: string, cause?: unknown) {
    super(
      `Full text is not available for ${sourceId}. Very recent or non-LaTeX papers are sometimes not rendered as HTML; the abstract is still usable.`,
    );
    this.name = "FullTextUnavailableError";
    this.cause = cause;
  }
}

const MIN_PASSAGE_CHARS = 150;

function clean(fragment: string): string {
  return fragment
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    // Rendered maths is noise in a text passage and confuses quoting.
    .replace(/<math[^>]*>[\s\S]*?<\/math>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "user-agent": "YouGo/1.0 (research workspace)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function parsePassages(html: string): Passage[] {
  // Group 1 is a section heading, group 2 a paragraph; scanning both in document
  // order is what lets each paragraph inherit the heading above it.
  const pattern =
    /(<h[1-6][^>]*ltx_title_(?:section|subsection)[^>]*>[\s\S]*?<\/h[1-6]>)|(<p[^>]*class="[^"]*\bltx_p\b[^"]*"[^>]*>[\s\S]*?<\/p>)/g;

  const passages: Passage[] = [];
  let section = "Abstract";

  for (const match of html.matchAll(pattern)) {
    const [, head, para] = match;
    if (head) {
      const heading = clean(head);
      if (heading) section = heading;
      continue;
    }
    if (!para) continue;
    const text = clean(para);
    if (text.length >= MIN_PASSAGE_CHARS) passages.push({ section, text });
  }

  return passages;
}

/**
 * Reads a paper as section-tagged paragraphs.
 *
 * Both renderers turn arXiv LaTeX into HTML and serve it to anyone — no key, no
 * IP restriction. arXiv's own rendering is tried first because it is first-party
 * and covers recent papers; ar5iv covers older ones arXiv never generated. Each
 * is tried twice, because a single slow response is common when a research run
 * fetches several papers back to back.
 */
export async function getFullText(sourceId: string): Promise<Passage[]> {
  const attempts = [
    readerUrl(sourceId),
    fallbackReaderUrl(sourceId),
    readerUrl(sourceId),
    fallbackReaderUrl(sourceId),
  ];

  let lastError: unknown;
  for (const url of attempts) {
    try {
      const passages = parsePassages(await fetchHtml(url));
      if (passages.length > 0) return passages;
    } catch (error) {
      lastError = error;
    }
  }

  throw new FullTextUnavailableError(sourceId, lastError);
}
