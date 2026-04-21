import React from "react";
import Box from "@mui/material/Box";
import LogbookItemSkeleton from "@/app/components/library/logbook-item-skeleton";

export default function LogbookLoading() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <LogbookItemSkeleton key={i} />
      ))}
    </Box>
  );
}
