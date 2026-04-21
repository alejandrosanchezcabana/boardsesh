"use client";

import React from "react";
import MuiCard from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import ChevronRightOutlined from "@mui/icons-material/ChevronRightOutlined";
import Link from "next/link";
import { themeTokens } from "@/app/theme/theme-config";

interface ProfileNavCardProps {
  title: string;
  subtitle?: string;
  href: string;
  icon: React.ReactNode;
}

export default function ProfileNavCard({ title, subtitle, href, icon }: ProfileNavCardProps) {
  return (
    <MuiCard
      component={Link}
      href={href}
      sx={{
        textDecoration: "none",
        color: "inherit",
        transition: `box-shadow ${themeTokens.transitions.normal}`,
        "&:hover": { boxShadow: themeTokens.shadows.md },
      }}
    >
      <CardContent
        sx={{ display: "flex", alignItems: "center", gap: 2, py: 2, "&:last-child": { pb: 2 } }}
      >
        <Box sx={{ color: "text.secondary", display: "flex" }}>{icon}</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        <ChevronRightOutlined sx={{ color: "text.secondary" }} />
      </CardContent>
    </MuiCard>
  );
}
