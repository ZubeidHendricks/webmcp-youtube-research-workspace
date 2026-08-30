import "server-only";
import { createGroq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { z } from "zod";
import { mutateWorkspace, readWorkspace } from "@/lib/workspace/server";
import { searchVideos } from "@/lib/youtube/search";
import { getTranscript } from "@/lib/youtube/transcript";
import { formatTimestamp } from "@/lib/youtube/types";
import { TEAM, type RoleKey } from "./roles";

/**
 * A four-stage research team that works *inside* a shared workspace.
 *
 * Each role joins as a participant and writes its findings as it goes, so the
 * researcher watches sources and notes appear rather than waiting for a report.
 * Nothing here returns to the caller — the workspace is the output.
 */

const MAX_SOURCES = 4;
/** gpt-oss models spend tokens on hidden reasoning before answering. */
const MAX_OUTPUT_TOKENS = 4000;

function model(role: RoleKey) {
  const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
  return groq(TEAM[role].model);
}

function agentId(workspaceId: string, role: RoleKey) {
  return `team-${role}-${workspaceId}`;
}

async function join(workspaceId: string, role: RoleKey) {
  await mutateWorkspace(workspaceId, {
    type: "join",
    participant: { id: agentId(workspaceId, role), label: TEAM[role].label, kind: "agent" },
  });
}

async function note(
  workspaceId: string,
  role: RoleKey,
  text: string,
  anchor?: { videoId: string; seconds: number; quote: string },
) {
  await mutateWorkspace(workspaceId, {
    type: "add_note",
    note: {
      authorId: agentId(workspaceId, role),
      authorLabel: TEAM[role].label,
      authorKind: "agent",
      text,
      anchor: anchor
        ? { ...anchor, timestamp: formatTimestamp(anchor.seconds) }
        : undefined,
    },
  });
}

export async function runResearchTeam(workspaceId: string, topic: string) {
  await mutateWorkspace(workspaceId, { type: "set_topic", topic });

  // ---- Scout: choose what is worth reading -------------------------------
  await join(workspaceId, "scout");
  const candidates = await searchVideos(topic, { maxResults: 12, captionedOnly: true });

  if (candidates.length === 0) {
    await note(workspaceId, "scout", `No YouTube results for "${topic}".`);
    return;
  }

  const picked = await generateObject({
    model: model("scout"),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    schema: z.object({
      choices: z
        .array(
          z.object({
            videoId: z.string(),
            why: z.string().describe("One sentence on why this source earns a slot."),
          }),
        )
        .max(MAX_SOURCES),
    }),
    prompt: `${TEAM.scout.brief}

Research topic: ${topic}

Candidates:
${candidates.map((c) => `- ${c.videoId} | ${c.title} | ${c.channelTitle} | ${c.description.slice(0, 160)}`).join("\n")}

Choose at most ${MAX_SOURCES} to research. Return their exact videoIds.`,
  });

  const chosen = picked.object.choices
    .map((choice) => ({
      choice,
      video: candidates.find((c) => c.videoId === choice.videoId),
    }))
    .filter((entry): entry is { choice: { videoId: string; why: string }; video: (typeof candidates)[number] } =>
      Boolean(entry.video),
    );

  for (const { choice, video } of chosen) {
    await mutateWorkspace(workspaceId, {
      type: "add_source",
      source: { ...video, addedBy: TEAM.scout.label },
    });
    await note(workspaceId, "scout", `Picked "${video.title}" — ${choice.why}`);
  }

  // ---- Reader: extract what each source actually claims -------------------
  await join(workspaceId, "reader");

  for (const { video } of chosen) {
    let transcriptText: string | null = null;
    try {
      const transcript = await getTranscript(video.videoId);
      await mutateWorkspace(workspaceId, {
        type: "set_transcript",
        videoId: video.videoId,
        segments: transcript.segments,
        from: TEAM.reader.label,
      });
      transcriptText = transcript.segments
        .map((segment) => `[${segment.seconds}] ${segment.text}`)
        .join("\n")
        .slice(0, 24_000);
    } catch {
      await mutateWorkspace(workspaceId, {
        type: "set_transcript_error",
        videoId: video.videoId,
        message:
          "No readable transcript from the server. Reader worked from the title and description instead.",
      });
    }

    const claims = await generateObject({
      model: model("reader"),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      schema: z.object({
        claims: z
          .array(
            z.object({
              quote: z.string().describe("Verbatim words from the source."),
              seconds: z
                .number()
                .nullable()
                .describe("Start time in seconds, or null if not from a transcript."),
              why: z.string().describe("Why this matters to the topic."),
            }),
          )
          .max(2),
      }),
      prompt: `${TEAM.reader.brief}

Research topic: ${topic}
Source: "${video.title}" by ${video.channelTitle}

${
  transcriptText
    ? `Transcript, each line prefixed with its start time in seconds:\n${transcriptText}`
    : `No transcript is available. Work only from this description, and set seconds to null:\n${video.description.slice(0, 2000)}`
}

Extract at most 2 claims. Quote verbatim.`,
    });

    for (const claim of claims.object.claims) {
      const seconds = transcriptText && claim.seconds !== null ? claim.seconds : null;
      await note(
        workspaceId,
        "reader",
        seconds === null ? `${claim.why} (from the description — no transcript)` : claim.why,
        seconds === null
          ? undefined
          : { videoId: video.videoId, seconds: Math.max(0, Math.floor(seconds)), quote: claim.quote },
      );
    }
  }

  // ---- Critic: challenge what the team has gathered -----------------------
  await join(workspaceId, "critic");
  const afterReading = await readWorkspace(workspaceId);

  const critique = await generateObject({
    model: model("critic"),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    schema: z.object({ points: z.array(z.string()).max(3) }),
    prompt: `${TEAM.critic.brief}

Research topic: ${topic}

Sources collected:
${afterReading.sources.map((s) => `- ${s.title} (${s.channelTitle})`).join("\n")}

Notes filed so far:
${afterReading.notes.map((n) => `- [${n.authorLabel}] ${n.anchor ? `"${n.anchor.quote}" — ` : ""}${n.text}`).join("\n")}

Give at most 3 specific challenges or gaps.`,
  });

  for (const point of critique.object.points) {
    await note(workspaceId, "critic", point);
  }

  // ---- Synthesist: say where this leaves the researcher -------------------
  await join(workspaceId, "synthesist");
  const afterCritique = await readWorkspace(workspaceId);

  const summary = await generateObject({
    model: model("synthesist"),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    schema: z.object({ summary: z.string() }),
    prompt: `${TEAM.synthesist.brief}

Research topic: ${topic}

Everything the team filed:
${afterCritique.notes.map((n) => `- [${n.authorLabel}] ${n.anchor ? `"${n.anchor.quote}" — ` : ""}${n.text}`).join("\n")}

Write a short standing summary: what is established, what is contested, what to look at next.`,
  });

  await note(workspaceId, "synthesist", summary.object.summary);
}
