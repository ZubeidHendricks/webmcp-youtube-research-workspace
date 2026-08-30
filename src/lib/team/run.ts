import "server-only";
import { createGroq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { z } from "zod";
import { indexPaper } from "@/lib/rag/index-passages";
import { mutateWorkspace, readWorkspace } from "@/lib/workspace/server";
import { searchPapers } from "@/lib/papers/search";
import { getFullText } from "@/lib/papers/fulltext";
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
  anchor?: { sourceId: string; section: string; quote: string },
) {
  await mutateWorkspace(workspaceId, {
    type: "add_note",
    note: {
      authorId: agentId(workspaceId, role),
      authorLabel: TEAM[role].label,
      authorKind: "agent",
      text,
      anchor,
    },
  });
}

export async function runResearchTeam(workspaceId: string, topic: string) {
  await mutateWorkspace(workspaceId, { type: "set_topic", topic });

  // ---- Scout: choose what is worth reading -------------------------------
  await join(workspaceId, "scout");
  const candidates = await searchPapers(topic, 12);

  if (candidates.length === 0) {
    await note(workspaceId, "scout", `No arXiv results for "${topic}".`);
    return;
  }

  const picked = await generateObject({
    model: model("scout"),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    schema: z.object({
      choices: z
        .array(
          z.object({
            sourceId: z.string(),
            why: z.string().describe("One sentence on why this source earns a slot."),
          }),
        )
        .max(MAX_SOURCES),
    }),
    prompt: `${TEAM.scout.brief}

Research topic: ${topic}

Candidates:
${candidates.map((c) => `- ${c.sourceId} | ${c.title} | ${c.published} | ${c.summary.slice(0, 200)}`).join("\n")}

Choose at most ${MAX_SOURCES} to research. Return their exact sourceIds.`,
  });

  const chosen = picked.object.choices
    .map((choice) => ({ choice, paper: candidates.find((c) => c.sourceId === choice.sourceId) }))
    .filter(
      (entry): entry is { choice: { sourceId: string; why: string }; paper: (typeof candidates)[number] } =>
        Boolean(entry.paper),
    );

  for (const { choice, paper } of chosen) {
    await mutateWorkspace(workspaceId, {
      type: "add_source",
      source: { ...paper, addedBy: TEAM.scout.label },
    });
    await note(workspaceId, "scout", `Picked "${paper.title}" — ${choice.why}`);
  }

  // ---- Reader: extract what each source actually claims -------------------
  await join(workspaceId, "reader");

  for (const { paper } of chosen) {
    let fullText: string | null = null;
    try {
      const passages = await getFullText(paper.sourceId);
      await mutateWorkspace(workspaceId, {
        type: "set_passages",
        sourceId: paper.sourceId,
        passages,
      });
      await indexPaper(workspaceId, paper.sourceId, paper.title, passages).catch(() => {});
      fullText = passages
        .map((passage) => `[${passage.section}] ${passage.text}`)
        .join("\n\n")
        .slice(0, 26_000);
    } catch {
      await mutateWorkspace(workspaceId, {
        type: "set_fulltext_error",
        sourceId: paper.sourceId,
        message: "Full text was not available; Reader worked from the abstract instead.",
      });
    }

    const claims = await generateObject({
      model: model("reader"),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      schema: z.object({
        claims: z
          .array(
            z.object({
              quote: z.string().describe("Verbatim words from the paper."),
              section: z.string().describe("The section the quote came from, or 'Abstract'."),
              why: z.string().describe("Why this matters to the topic."),
            }),
          )
          .max(2),
      }),
      prompt: `${TEAM.reader.brief}

Research topic: ${topic}
Paper: "${paper.title}" (${paper.published})

${
  fullText
    ? `Full text, each paragraph prefixed with its section:\n${fullText}`
    : `Only the abstract is available:\n${paper.summary}`
}

Extract at most 2 claims. Quote verbatim, and keep each quote under 40 words so it can be located in the paper.`,
    });

    for (const claim of claims.object.claims) {
      await note(workspaceId, "reader", claim.why, {
        sourceId: paper.sourceId,
        section: claim.section || (fullText ? "" : "Abstract"),
        quote: claim.quote,
      });
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
${afterReading.sources.map((s) => `- ${s.title} (${s.published})`).join("\n")}

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
