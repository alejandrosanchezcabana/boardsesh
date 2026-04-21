import React from "react";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";

export default function YouLoading() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Skeleton variant="rounded" height={120} animation="wave" sx={{ borderRadius: "12px" }} />
      <Skeleton variant="rounded" height={200} animation="wave" sx={{ borderRadius: "12px" }} />
      <Skeleton variant="rounded" height={160} animation="wave" sx={{ borderRadius: "12px" }} />
    </Box>
  );
}
