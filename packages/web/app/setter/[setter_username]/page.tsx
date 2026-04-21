import React from "react";
import type { Metadata } from "next";
import SetterProfileContent from "./setter-profile-content";
import styles from "@/app/components/library/playlist-view.module.css";
import { buildVersionedOgImagePath, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "@/app/lib/seo/og";
import { getSetterOgSummary } from "@/app/lib/seo/dynamic-og-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ setter_username: string }>;
}): Promise<Metadata> {
  const { setter_username } = await params;
  const username = decodeURIComponent(setter_username);

  try {
    const summary = await getSetterOgSummary(username);
    const displayName = summary.displayName;
    const ogImagePath = buildVersionedOgImagePath("/api/og/setter", { username }, summary.version);
    const title = `${displayName} - Setter | Boardsesh`;
    const description = `Climbs created by ${displayName} on Boardsesh`;
    const canonicalUrl = `/setter/${encodeURIComponent(setter_username)}`;

    return {
      title,
      description,
      alternates: { canonical: canonicalUrl },
      openGraph: {
        title,
        description,
        url: canonicalUrl,
        images: [
          {
            url: ogImagePath,
            width: OG_IMAGE_WIDTH,
            height: OG_IMAGE_HEIGHT,
            alt: `${displayName}'s setter profile`,
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
      title: "Setter Profile | Boardsesh",
      description: "View setter profile and climbs on Boardsesh",
    };
  }
}

export default async function SetterProfilePage({
  params,
}: {
  params: Promise<{ setter_username: string }>;
}) {
  const { setter_username } = await params;

  return (
    <div className={styles.pageContainer}>
      <SetterProfileContent username={decodeURIComponent(setter_username)} />
    </div>
  );
}
