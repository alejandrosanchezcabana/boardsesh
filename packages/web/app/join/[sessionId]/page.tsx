import React from "react";
import type { Metadata } from "next";
import { BOULDER_GRADES } from "@/app/lib/board-data";
import JoinRedirect from "./join-redirect";
import { buildVersionedOgImagePath, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "@/app/lib/seo/og";
import { getSessionOgSummary } from "@/app/lib/seo/dynamic-og-data";

type Props = {
  params: Promise<{ sessionId: string }>;
};

const DIFFICULTY_TO_GRADE: Record<number, string> = Object.fromEntries(
  BOULDER_GRADES.map((g) => [g.difficulty_id, g.font_grade]),
);

function buildJoinHeadline(leaderName: string | null) {
  return leaderName ? `Join ${leaderName} on the wall` : "Join the crew on the wall";
}

function buildGradeSummary(grades: string[]): string {
  if (grades.length === 0) {
    return "";
  }

  if (grades.length === 1) {
    return ` on ${grades[0]}`;
  }

  return ` from ${grades[0]} to ${grades[grades.length - 1]}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sessionId: rawSessionId } = await params;
  const sessionId = decodeURIComponent(rawSessionId);

  try {
    const summary = await getSessionOgSummary(sessionId);

    if (!summary.found) {
      return { title: "Session Not Found | Boardsesh" };
    }

    const sessionName = summary.sessionName;
    const grades = summary.gradeRows.map((r) => DIFFICULTY_TO_GRADE[r.difficulty]).filter(Boolean);
    const gradeSummary = buildGradeSummary(grades);
    const joinHeadline = buildJoinHeadline(summary.leaderName);
    const boardInfo = summary.boardLabel
      ? `${summary.boardLabel}${summary.boardAngle != null ? ` at ${summary.boardAngle}°` : ""}`
      : null;

    const title = `${joinHeadline} | Boardsesh`;
    const description = boardInfo
      ? summary.totalSends > 0
        ? `${boardInfo}. ${summary.totalSends} send${summary.totalSends !== 1 ? "s" : ""} so far${gradeSummary}. Get on the wall.`
        : `${boardInfo}. No sends yet. Get on the wall.`
      : sessionName && sessionName !== "Climbing Session"
        ? `${sessionName} is live on Boardsesh. Get on the wall.`
        : "Jump into this climbing session on Boardsesh. Get on the wall.";

    const ogImagePath = buildVersionedOgImagePath(
      "/api/og/session",
      { sessionId, variant: "join" },
      summary.version,
    );

    return {
      title,
      description,
      robots: { index: false, follow: true },
      openGraph: {
        title,
        description,
        type: "website",
        url: `/join/${sessionId}`,
        images: [
          {
            url: ogImagePath,
            width: OG_IMAGE_WIDTH,
            height: OG_IMAGE_HEIGHT,
            alt: joinHeadline,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImagePath],
      },
    };
  } catch {
    return {
      title: "Join Session | Boardsesh",
      description: "Join a climbing session on Boardsesh",
      robots: { index: false, follow: true },
    };
  }
}

export default async function JoinSessionPage({ params }: Props) {
  const { sessionId: rawSessionId } = await params;
  const sessionId = decodeURIComponent(rawSessionId);

  const joinUrl = `/api/internal/join/${encodeURIComponent(sessionId)}`;

  return (
    <>
      <noscript>
        <meta httpEquiv="refresh" content={`0;url=${joinUrl}`} />
      </noscript>
      <JoinRedirect sessionId={sessionId} joinUrl={joinUrl} />
    </>
  );
}
