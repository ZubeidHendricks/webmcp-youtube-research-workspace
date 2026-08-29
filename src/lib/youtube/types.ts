export interface VideoResult {
  videoId: string;
  title: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  description: string;
  thumbnail: string;
}

export interface TranscriptSegment {
  /** Human-readable "m:ss" / "h:mm:ss" mark. */
  timestamp: string;
  /** Start offset in whole seconds — used to build ?t= deep links. */
  seconds: number;
  text: string;
}

export interface TranscriptResult {
  videoId: string;
  language: string;
  segments: TranscriptSegment[];
}

export function formatTimestamp(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    : `${m}:${s.toString().padStart(2, "0")}`;
}

/** Parses "3:12", "1:03:12", or a raw second count into seconds. */
export function parseTimestamp(value: string | number): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? Math.floor(value) : null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const parts = trimmed.split(":").map((part) => Number(part));
  if (parts.length < 2 || parts.length > 3 || parts.some((n) => !Number.isFinite(n))) {
    return null;
  }
  return parts.reduce((total, part) => total * 60 + part, 0);
}

/** Accepts a bare id, a watch URL, a youtu.be link, or a shorts link. */
export function extractVideoId(input: string): string | null {
  const value = input.trim();
  if (/^[\w-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value);
    const fromQuery = url.searchParams.get("v");
    if (fromQuery && /^[\w-]{11}$/.test(fromQuery)) return fromQuery;
    const segments = url.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && /^[\w-]{11}$/.test(last)) return last;
  } catch {
    // not a URL
  }
  return null;
}
