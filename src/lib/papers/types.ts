export interface PaperResult {
  /** arXiv id, e.g. "2210.03629" (version suffix stripped). */
  sourceId: string;
  title: string;
  authors: string[];
  published: string;
  summary: string;
  /** Canonical abstract page. */
  url: string;
}

/** One paragraph of a paper, tagged with the section it came from. */
export interface Passage {
  section: string;
  text: string;
}

const ARXIV_ID = /^\d{4}\.\d{4,5}$/;

/** Accepts a bare id, an abs/pdf/ar5iv URL, or an id with a version suffix. */
export function extractPaperId(input: string): string | null {
  const value = input.trim();
  const bare = value.replace(/v\d+$/, "");
  if (ARXIV_ID.test(bare)) return bare;

  const match = value.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})/i)
    ?? value.match(/ar5iv[^/]*\/html\/(\d{4}\.\d{4,5})/i);
  return match ? match[1] : null;
}

export function abstractUrl(sourceId: string): string {
  return `https://arxiv.org/abs/${sourceId}`;
}

/** arXiv's own HTML rendering — first-party, and the best coverage of recent papers. */
export function readerUrl(sourceId: string): string {
  return `https://arxiv.org/html/${sourceId}`;
}

/** ar5iv renders older papers that arXiv never generated HTML for. */
export function fallbackReaderUrl(sourceId: string): string {
  return `https://ar5iv.labs.arxiv.org/html/${sourceId}`;
}

/**
 * A link that opens the paper scrolled to the quoted sentence and highlights it.
 *
 * Chrome text fragments are the papers equivalent of a video timestamp: one
 * click takes the reader to the exact words, so a citation stays checkable.
 * Long quotes match less reliably, so the fragment is trimmed to its opening.
 */
export function quoteUrl(sourceId: string, quote: string): string {
  const trimmed = quote.trim().replace(/\s+/g, " ").slice(0, 120);
  return `${readerUrl(sourceId)}#:~:text=${encodeURIComponent(trimmed)}`;
}
