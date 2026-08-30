import "server-only";
import { Index } from "@upstash/vector";
import { formatTimestamp, type TranscriptSegment } from "@/lib/youtube/types";

/**
 * Transcript retrieval.
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

export interface Passage {
  videoId: string;
  title: string;
  seconds: number;
  timestamp: string;
  text: string;
}

/**
 * Caption lines are a few words each — far too small to answer a question
 * against. Merge them into overlapping windows of roughly a paragraph, keeping
 * the first line's start time so a citation still points at the right moment.
 */
const TARGET_CHARS = 700;
const OVERLAP_SEGMENTS = 2;

export function chunkTranscript(
  segments: TranscriptSegment[],
): { seconds: number; timestamp: string; text: string }[] {
  const chunks: { seconds: number; timestamp: string; text: string }[] = [];

  let start = 0;
  while (start < segments.length) {
    let end = start;
    let text = "";
    while (end < segments.length && text.length < TARGET_CHARS) {
      text = text ? `${text} ${segments[end].text}` : segments[end].text;
      end++;
    }

    const trimmed = text.trim();
    if (trimmed) {
      chunks.push({
        seconds: segments[start].seconds,
        timestamp: formatTimestamp(segments[start].seconds),
        text: trimmed,
      });
    }

    if (end >= segments.length) break;
    // Step forward, keeping a little overlap so a claim spanning a boundary is
    // still retrievable. Always advance at least one segment.
    start = Math.max(start + 1, end - OVERLAP_SEGMENTS);
  }

  return chunks;
}

function escape(value: string) {
  return value.replace(/['"\\]/g, "");
}

export async function indexTranscript(
  workspaceId: string,
  videoId: string,
  title: string,
  segments: TranscriptSegment[],
): Promise<number> {
  const passages = chunkTranscript(segments);
  if (passages.length === 0) return 0;

  const namespace = vectorIndex().namespace(workspaceId);
  // Re-indexing a source replaces its passages rather than duplicating them.
  await namespace.delete({ filter: `videoId = '${escape(videoId)}'` }).catch(() => {});

  const vectors = passages.map((passage, position) => ({
    id: `${workspaceId}:${videoId}:${position}`,
    data: passage.text,
    metadata: {
      videoId,
      title,
      seconds: passage.seconds,
      timestamp: passage.timestamp,
      text: passage.text,
    },
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
): Promise<Passage[]> {
  const results = await vectorIndex()
    .namespace(workspaceId)
    .query({ data: question, topK, includeMetadata: true });

  return (results ?? []).flatMap((result) => {
    const meta = result.metadata as unknown as Passage | undefined;
    return meta?.text ? [meta] : [];
  });
}

export async function clearSourceFromIndex(workspaceId: string, videoId: string) {
  await vectorIndex()
    .namespace(workspaceId)
    .delete({ filter: `videoId = '${escape(videoId)}'` })
    .catch(() => {});
}
