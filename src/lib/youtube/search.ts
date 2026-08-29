import "server-only";
import { withYouTubeClient } from "./client";
import type { VideoResult } from "./types";

export async function searchVideos(
  query: string,
  maxResults = 8,
): Promise<VideoResult[]> {
  const response = await withYouTubeClient((youtube) =>
    youtube.search.list({
      part: ["snippet"],
      q: query,
      type: ["video"],
      maxResults: Math.min(Math.max(maxResults, 1), 25),
    }),
  );

  return (response.data.items ?? []).flatMap((item): VideoResult[] => {
    const videoId = item.id?.videoId;
    const snippet = item.snippet;
    if (!videoId || !snippet) return [];
    return [
      {
        videoId,
        title: snippet.title ?? "Untitled",
        channelTitle: snippet.channelTitle ?? "Unknown channel",
        channelId: snippet.channelId ?? "",
        publishedAt: snippet.publishedAt ?? "",
        description: snippet.description ?? "",
        thumbnail: snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url ?? "",
      },
    ];
  });
}

export async function getVideo(videoId: string): Promise<VideoResult | null> {
  const response = await withYouTubeClient((youtube) =>
    youtube.videos.list({ part: ["snippet"], id: [videoId] }),
  );

  const item = response.data.items?.[0];
  const snippet = item?.snippet;
  if (!snippet) return null;

  return {
    videoId,
    title: snippet.title ?? "Untitled",
    channelTitle: snippet.channelTitle ?? "Unknown channel",
    channelId: snippet.channelId ?? "",
    publishedAt: snippet.publishedAt ?? "",
    description: snippet.description ?? "",
    thumbnail: snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url ?? "",
  };
}
