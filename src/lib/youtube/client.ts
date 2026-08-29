import { google, type youtube_v3 } from "googleapis";

/**
 * Quota-aware YouTube client pool.
 *
 * Adapted from ZubeidHendricks/youtube-mcp-server (src/services/youtube-client.ts):
 * YouTube Data API keys have a hard daily quota, so we rotate through every
 * configured key and remember which ones are exhausted for this instance's lifetime.
 */

type YouTubeClient = youtube_v3.Youtube;

const QUOTA_ERROR_REASONS = new Set([
  "quotaExceeded",
  "dailyLimitExceeded",
  "userRateLimitExceeded",
  "rateLimitExceeded",
]);

function configuredApiKeys(): string[] {
  return [
    process.env.YOUTUBE_API_KEY,
    process.env.YOUTUBE_API_KEY2,
    process.env.YOUTUBE_API_KEY3,
  ].filter((value): value is string => Boolean(value?.trim()));
}

export function hasConfiguredYouTubeApiKey(): boolean {
  return configuredApiKeys().length > 0;
}

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "No YouTube Data API key configured. Set YOUTUBE_API_KEY (optionally YOUTUBE_API_KEY2/3) in your environment.",
    );
    this.name = "MissingApiKeyError";
  }
}

function isQuotaError(error: unknown): boolean {
  const err = error as {
    errors?: { reason?: string }[];
    response?: { data?: { error?: { errors?: { reason?: string }[]; message?: string } } };
    message?: string;
  };

  const reasons = [
    ...(err?.errors ?? []),
    ...(err?.response?.data?.error?.errors ?? []),
  ]
    .map((item) => item?.reason)
    .filter((reason): reason is string => Boolean(reason));

  if (reasons.some((reason) => QUOTA_ERROR_REASONS.has(reason))) return true;

  const message = String(
    err?.message ?? err?.response?.data?.error?.message ?? "",
  ).toLowerCase();

  return (
    message.includes("quota") ||
    message.includes("daily limit") ||
    message.includes("rate limit")
  );
}

let clients: YouTubeClient[] | null = null;
const exhausted = new Set<number>();

function getClients(): YouTubeClient[] {
  const keys = configuredApiKeys();
  if (keys.length === 0) throw new MissingApiKeyError();
  // Rebuild if the key count changed (e.g. env reloaded in dev).
  if (!clients || clients.length !== keys.length) {
    clients = keys.map((auth) => google.youtube({ version: "v3", auth }));
    exhausted.clear();
  }
  return clients;
}

/** Runs `request` against the first non-exhausted key, falling forward on quota errors. */
export async function withYouTubeClient<T>(
  request: (youtube: YouTubeClient) => Promise<T>,
): Promise<T> {
  const pool = getClients();
  const candidates = pool
    .map((_, index) => index)
    .filter((index) => !exhausted.has(index));
  const order = candidates.length > 0 ? candidates : pool.map((_, i) => i);

  let lastError: unknown;
  for (const index of order) {
    try {
      return await request(pool[index]);
    } catch (error) {
      lastError = error;
      if (isQuotaError(error)) {
        exhausted.add(index);
        console.warn(`[youtube] key ${index + 1} out of quota, trying next`);
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    `All configured YouTube API keys failed${
      lastError instanceof Error ? `: ${lastError.message}` : "."
    }`,
  );
}
