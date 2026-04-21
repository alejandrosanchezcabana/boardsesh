"use client";

import React, { useCallback } from "react";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { useRouter, usePathname } from "next/navigation";

type YouTab = "progress" | "sessions" | "logbook";

export default function YouTabBar() {
  const router = useRouter();
  const pathname = usePathname();

  const activeTab: YouTab =
    pathname === "/you/sessions"
      ? "sessions"
      : pathname === "/you/logbook"
        ? "logbook"
        : "progress";

  const handleTabChange = useCallback(
    (_: React.SyntheticEvent, value: YouTab) => {
      const path = value === "progress" ? "/you" : `/you/${value}`;
      router.push(path, { scroll: false });
    },
    [router],
  );

  return (
    <Tabs value={activeTab} onChange={handleTabChange} variant="fullWidth" sx={{ mb: 2 }}>
      <Tab label="Progress" value="progress" />
      <Tab label="Sessions" value="sessions" />
      <Tab label="Logbook" value="logbook" />
    </Tabs>
  );
}
