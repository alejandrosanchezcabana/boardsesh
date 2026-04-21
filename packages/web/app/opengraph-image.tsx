import React from "react";
import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Boardsesh - Train smarter on your climbing board";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0A0A0A",
        fontFamily: "sans-serif",
      }}
    >
      {/* Logo text */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          marginBottom: 24,
        }}
      >
        <span
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "#5DBE94",
            letterSpacing: "-1px",
          }}
        >
          Board
        </span>
        <span
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "#C75B64",
            letterSpacing: "-1px",
          }}
        >
          sesh
        </span>
      </div>

      {/* Tagline */}
      <div
        style={{
          fontSize: 32,
          color: "#E5E5E5",
          fontWeight: 500,
          marginBottom: 16,
        }}
      >
        Train smarter on your climbing board
      </div>

      {/* Sub-text */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          fontSize: 20,
          color: "#888888",
        }}
      >
        <span>Track sessions</span>
        <span style={{ color: "#444444" }}>|</span>
        <span>Control LEDs</span>
        <span style={{ color: "#444444" }}>|</span>
        <span>Climb together</span>
      </div>

      {/* Supported boards */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginTop: 48,
          fontSize: 16,
          color: "#666666",
        }}
      >
        <span>Kilter</span>
        <span style={{ color: "#333333" }}>-</span>
        <span>Tension</span>
        <span style={{ color: "#333333" }}>-</span>
        <span>MoonBoard</span>
      </div>
    </div>,
    { ...size },
  );
}
