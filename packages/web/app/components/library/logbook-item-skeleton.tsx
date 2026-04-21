import React from "react";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import MuiCard from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import feedStyles from "@/app/components/activity-feed/ascents-feed.module.css";

export default function LogbookItemSkeleton() {
  return (
    <MuiCard className={feedStyles.feedItem}>
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Skeleton
            variant="rounded"
            width={64}
            height={64}
            animation="wave"
            sx={{ flexShrink: 0 }}
          />
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Skeleton variant="rounded" width={80} height={24} animation="wave" />
              <Skeleton variant="rounded" width={100} height={16} animation="wave" />
            </Box>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Skeleton variant="rounded" width={40} height={24} animation="wave" />
              <Skeleton variant="rounded" width={48} height={24} animation="wave" />
            </Box>
          </Box>
        </Box>
      </CardContent>
    </MuiCard>
  );
}
