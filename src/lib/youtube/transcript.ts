import "server-only";
import { YoutubeTranscript } from "youtube-transcript";
import { formatTimestamp, type TranscriptResult } from "./types";

export class TranscriptUnavailableError extends Error {
  constructor(videoId: string, cause?: unknown) {
    super(
      `No transcript available for video ${videoId}. It may have captions disabled, be age-restricted, or YouTube may be blocking this server's IP.`,
    );
    this.name = "TranscriptUnavailableError";
    this.cause = cause;
  }
}

/**
 * Fetches timestamped captions. Adapted from the TranscriptService in
 * ZubeidHendricks/youtube-mcp-server — no API key or quota needed, but it
 * scrapes YouTube's caption endpoint, so it can fail where the Data API works.
 */
export async function getTranscript(
  videoId: string,
  language = process.env.YOUTUBE_TRANSCRIPT_LANG || "en",
): Promise<TranscriptResult> {
  let raw;
  try {
    raw = await YoutubeTranscript.fetchTranscript(videoId, { lang: language });
  } catch (error) {
    throw new TranscriptUnavailableError(videoId, error);
  }

  if (!raw || raw.length === 0) throw new TranscriptUnavailableError(videoId);

  return {
    videoId,
    language,
    segments: raw.map((item) => {
      // youtube-transcript reports offsets in milliseconds.
      const seconds = Math.floor(item.offset / 1000);
      return {
        seconds,
        timestamp: formatTimestamp(seconds),
        text: item.text.replace(/\s+/g, " ").trim(),
      };
    }),
  };
}
