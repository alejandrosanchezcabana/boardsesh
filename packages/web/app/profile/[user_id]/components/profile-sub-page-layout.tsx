"use client";

import React from "react";
import Box from "@mui/material/Box";
import styles from "../profile-page.module.css";

interface ProfileSubPageLayoutProps {
  children: React.ReactNode;
}

export default function ProfileSubPageLayout({ children }: ProfileSubPageLayoutProps) {
  return (
    <Box className={styles.layout}>
      <Box component="main" className={styles.content}>
        {children}
      </Box>
    </Box>
  );
}
