import React from "react";
import { Metadata } from "next";
import ClimbsContent from "./climbs-content";

type PageProps = { params: Promise<{ user_id: string }> };

export const metadata: Metadata = {
  title: "Created Climbs | Boardsesh",
  robots: { index: false, follow: true },
};

export default async function ProfileClimbsPage({ params }: PageProps) {
  const { user_id } = await params;
  return <ClimbsContent userId={user_id} />;
}
