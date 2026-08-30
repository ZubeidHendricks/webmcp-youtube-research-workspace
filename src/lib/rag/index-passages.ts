import "server-only";
import { Index } from "@upstash/vector";
import type { Passage as PaperPassage } from "@/lib/papers/types";

/**
 * Full-text retrieval over collected papers.
 *
 * Upstash Vector with a hosted embedding model, so passages are embedded on
 * upsert and the question is embedded on query — no separate embedding provider.
 * Vectors are namespaced per workspace, so one research session never retrieves
 * another's sources.
 */
let index: Index | null = null;

function vectorIndex(): Index {
  if (!index) {
    const url = process.env.UPSTASH_VECTOR_REST_URL;
    const token = process.env.UPSTASH_VECTOR_REST_TOKEN;
    if (!url || !token) throw new Error("Vector search is not configured.");
    index = new Index({ url, token });
  }
  return index;
}

/** A retrievable chunk, carrying enough context to cite it. */
export interface IndexedPassage {
  sourceId: string;
  title: string;
  section: string;
  text: string;
}

/**
 * Paper paragraphs are already close to the right size to answer against, but
 * they vary a lot — a one-line paragraph carries little meaning on its own. Merge
 * consecutive paragraphs from the same section up to a target size, keeping the
 * section label so a citation can say where it came from.
 */
const TARGET_CHARS = 1200;
const OVERLAP_PASSAGES = 1;

export function chunkPassages(
  passages: PaperPassage[],
): { section: string; text: string }[] {
  const chunks: { section: string; text: string }[] = [];

  let start = 0;
  while (start < passages.length) {
    const section = passages[start].section;
    let end = start;
    let text = "";
    // Never merge across a section boundary — the label has to stay truthful.
    while (
      end < passages.length &&
      passages[end].section === section &&
      text.length < TARGET_CHARS
    ) {
      text = text ? `${text} ${passages[end].text}` : passages[end].text;
      end++;
    }

    const trimmed = text.trim();
    if (trimmed) chunks.push({ section, text: trimmed });

    if (end >= passages.length) break;
    start = end === start ? start + 1 : Math.max(start + 1, end - OVERLAP_PASSAGES);
  }

  return chunks;
}

function escape(value: string) {
  return value.replace(/['"\\]/g, "");
}

export async function indexPaper(
  workspaceId: string,
  sourceId: string,
  title: string,
  passages: PaperPassage[],
): Promise<number> {
  const chunks = chunkPassages(passages);
  if (chunks.length === 0) return 0;

  const namespace = vectorIndex().namespace(workspaceId);
  // Re-indexing a source replaces its chunks rather than duplicating them.
  await namespace.delete({ filter: `sourceId = '${escape(sourceId)}'` }).catch(() => {});

  const vectors = chunks.map((chunk, position) => ({
    id: `${workspaceId}:${sourceId}:${position}`,
    data: chunk.text,
    metadata: { sourceId, title, section: chunk.section, text: chunk.text },
  }));

  for (let i = 0; i < vectors.length; i += 50) {
    await namespace.upsert(vectors.slice(i, i + 50));
  }
  return vectors.length;
}

export async function searchPassages(
  workspaceId: string,
  question: string,
  topK = 8,
): Promise<IndexedPassage[]> {
  const results = await vectorIndex()
    .namespace(workspaceId)
    .query({ data: question, topK, includeMetadata: true });

  return (results ?? []).flatMap((result) => {
    const meta = result.metadata as unknown as IndexedPassage | undefined;
    return meta?.text ? [meta] : [];
  });
}

export async function clearSourceFromIndex(workspaceId: string, sourceId: string) {
  await vectorIndex()
    .namespace(workspaceId)
    .delete({ filter: `sourceId = '${escape(sourceId)}'` })
    .catch(() => {});
}
