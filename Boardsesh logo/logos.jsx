/* global React */

// ---------------------------------------------------------------------------
// Boardsesh — Multi-color route system
// ---------------------------------------------------------------------------
const T = {
  bg: "#0e0e10",
  bgAlt: "#17171a",
  ink: "#f4f1ea",
  inkDim: "#8a8780",
  coral: "#d65a4f",
  // Route role colors — universal across LED boards
  start: "#c44a8a",   // magenta
  hand: "#3fb8c4",    // cyan
  foot: "#5fb27a",    // green
  finish: "#e2a44d",  // orange
};

const display = {
  fontFamily: '"Archivo", "Helvetica Neue", Helvetica, Arial, sans-serif',
  fontWeight: 800,
  letterSpacing: "-0.025em",
};
const mono = {
  fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
};

// Frame ----------------------------------------------------------------------
function Frame({ label, caption, bg, children, pad = 32 }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: bg ?? T.bg,
        color: T.ink,
        padding: pad,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ ...mono, fontSize: 10, color: T.inkDim, letterSpacing: "0.2em", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 14 }}>
        {children}
      </div>
      <div style={{ ...mono, fontSize: 10, color: T.inkDim, borderTop: "1px solid #1f1f23", paddingTop: 10 }}>
        {caption}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The route mark — reusable, parametric
// ---------------------------------------------------------------------------
// 4 holds in a diamond climb: start (bottom) → foot/hand → hand → finish (top)
function RouteMark({ size = 64, holdColor = "#7a7a7e", showContext = true, ringWidth }) {
  const w = size, h = size;
  // Coordinates within a 64x64 viewbox
  const VB = 64;
  const ctx = [
    [10, 12, 3.6, 2.4, -10],
    [52, 16, 3.6, 2.4, 20],
    [14, 50, 3.6, 2.4, 25],
    [54, 50, 3.6, 2.4, -15],
    [32, 32, 3.2, 2.2, 5],
    [22, 28, 3, 2, -25],
    [44, 36, 3, 2, 14],
  ];
  // Order top→bottom: purple/start (top), cyan, green, orange (bottom)
  const moves = [
    { cx: 28, cy: 10, color: T.start, rot: -8, rx: 4, ry: 2.8 },
    { cx: 46, cy: 26, color: T.hand, rot: 18, rx: 4, ry: 2.8 },
    { cx: 18, cy: 38, color: T.foot, rot: -22, rx: 3.6, ry: 2.6 },
    { cx: 32, cy: 54, color: T.finish, rot: 5, rx: 4, ry: 2.8 },
  ];
  const rw = ringWidth ?? Math.max(1.6, size / 32);
  const ringR = 9;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${VB} ${VB}`}>
      {showContext &&
        ctx.map(([cx, cy, rx, ry, rot], i) => (
          <ellipse
            key={i}
            cx={cx}
            cy={cy}
            rx={rx}
            ry={ry}
            fill="#4a4a52"
            transform={`rotate(${rot} ${cx} ${cy})`}
          />
        ))}
      {moves.map((m, i) => (
        <g key={i}>
          <ellipse cx={m.cx} cy={m.cy} rx={m.rx} ry={m.ry} fill={holdColor} transform={`rotate(${m.rot} ${m.cx} ${m.cy})`} />
          <circle cx={m.cx} cy={m.cy} r={ringR} fill="none" stroke={m.color} strokeWidth={rw} />
        </g>
      ))}
    </svg>
  );
}

// Mark that fills its container regardless of size
function RouteMarkScalable({ holdColor, showContext, ringWidth, style }) {
  return (
    <div style={{ width: "100%", height: "100%", ...style }}>
      <svg width="100%" height="100%" viewBox="0 0 64 64" preserveAspectRatio="xMidYMid meet">
        {/* inline copy of RouteMark contents to avoid nested width=size mismatch */}
        {showContext !== false &&
          [
            [10, 12, 3.6, 2.4, -10],
            [52, 16, 3.6, 2.4, 20],
            [14, 50, 3.6, 2.4, 25],
            [54, 50, 3.6, 2.4, -15],
            [32, 32, 3.2, 2.2, 5],
            [22, 28, 3, 2, -25],
            [44, 36, 3, 2, 14],
          ].map(([cx, cy, rx, ry, rot], i) => (
            <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill="#4a4a52" transform={`rotate(${rot} ${cx} ${cy})`} />
          ))}
        {[
          { cx: 28, cy: 10, color: T.start, rot: -8, rx: 4, ry: 2.8 },
          { cx: 46, cy: 26, color: T.hand, rot: 18, rx: 4, ry: 2.8 },
          { cx: 18, cy: 38, color: T.foot, rot: -22, rx: 3.6, ry: 2.6 },
          { cx: 32, cy: 54, color: T.finish, rot: 5, rx: 4, ry: 2.8 },
        ].map((m, i) => (
          <g key={i}>
            <ellipse cx={m.cx} cy={m.cy} rx={m.rx} ry={m.ry} fill={holdColor ?? "#7a7a7e"} transform={`rotate(${m.rot} ${m.cx} ${m.cy})`} />
            <circle cx={m.cx} cy={m.cy} r={9} fill="none" stroke={m.color} strokeWidth={ringWidth ?? 2} />
          </g>
        ))}
      </svg>
    </div>
  );
}

// ===========================================================================
// 1. App icon set — all platforms, multiple flavors
// ===========================================================================
function AppIcons() {
  const Icon = ({ bg, holdColor, label, size = 96 }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.225,
          background: bg,
          boxShadow: "0 10px 28px rgba(0,0,0,0.45)",
          overflow: "hidden",
          padding: size * 0.06,
          boxSizing: "border-box",
        }}
      >
        <RouteMarkScalable holdColor={holdColor} showContext={true} ringWidth={2.2} />
      </div>
      <div style={{ ...mono, fontSize: 9, color: T.inkDim, letterSpacing: "0.15em", textTransform: "uppercase" }}>
        {label}
      </div>
    </div>
  );
  return (
    <Frame label="App icons" caption="Same mark, three surfaces. iOS / Android / web all map cleanly.">
      <div style={{ display: "flex", gap: 22, alignItems: "flex-end" }}>
        <Icon bg={T.bgAlt} holdColor="#5a5a5e" label="Dark" />
        <Icon bg={T.ink} holdColor="#8a8780" label="Light" />
        <Icon bg={T.coral} holdColor="#7a2a24" label="Coral" />
        <Icon bg="#1d2a35" holdColor="#3a4a55" label="Deep" />
      </div>
    </Frame>
  );
}

// ===========================================================================
// 2. App icon — scale ladder
// ===========================================================================
function AppIconScale() {
  const sizes = [128, 88, 56, 36, 22];
  return (
    <Frame label="Scale ladder" caption="The mark holds up from 1024px to 22px favicon.">
      <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
        {sizes.map((s, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: s,
                height: s,
                borderRadius: s * 0.225,
                background: T.bgAlt,
                overflow: "hidden",
                padding: s * 0.06,
                boxSizing: "border-box",
              }}
            >
              <RouteMarkScalable holdColor="#5a5a5e" ringWidth={s < 40 ? 3 : 2.2} />
            </div>
            <div style={{ ...mono, fontSize: 9, color: T.inkDim }}>{s}px</div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

// ===========================================================================
// 3. Primary lockup — horizontal
// ===========================================================================
function LockupHorizontal() {
  return (
    <Frame label="Primary lockup — horizontal" caption="The default — use everywhere there's room.">
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <RouteMark size={84} holdColor="#7a7a7e" />
        <div>
          <div style={{ ...display, fontSize: 56, color: T.ink, lineHeight: 1 }}>boardsesh</div>
          <div style={{ ...mono, fontSize: 11, color: T.inkDim, marginTop: 8, letterSpacing: "0.18em" }}>
            TRACK · TRAIN · CLIMB TOGETHER
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ===========================================================================
// 4. Primary lockup — stacked
// ===========================================================================
function LockupStacked() {
  return (
    <Frame label="Stacked lockup" caption="Square layouts — social avatars, splash screens.">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <RouteMark size={108} holdColor="#7a7a7e" />
        <div style={{ textAlign: "center" }}>
          <div style={{ ...display, fontSize: 48, color: T.ink, lineHeight: 1 }}>boardsesh</div>
          <div style={{ ...mono, fontSize: 10, color: T.inkDim, marginTop: 8, letterSpacing: "0.22em" }}>
            TRACK · TRAIN · CLIMB TOGETHER
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ===========================================================================
// 5. Compact lockup — for nav bars, footers
// ===========================================================================
function LockupCompact() {
  return (
    <Frame label="Compact lockup" caption="Nav bars, footers, business cards.">
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <RouteMark size={32} holdColor="#7a7a7e" ringWidth={2.4} />
          <span style={{ ...display, fontSize: 22, color: T.ink, lineHeight: 1 }}>boardsesh</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <RouteMark size={24} holdColor="#7a7a7e" ringWidth={2.6} />
          <span style={{ ...display, fontSize: 16, color: T.ink, lineHeight: 1 }}>boardsesh</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <RouteMark size={18} holdColor="#7a7a7e" ringWidth={3} />
          <span style={{ ...display, fontSize: 12, color: T.ink, lineHeight: 1 }}>boardsesh</span>
        </div>
      </div>
    </Frame>
  );
}

// ===========================================================================
// 6. Mark only — clear-space spec
// ===========================================================================
function ClearSpace() {
  return (
    <Frame label="Mark + clear space" caption="Minimum padding = 1× ring radius around the mark.">
      <div
        style={{
          position: "relative",
          width: 220,
          height: 220,
          background: T.bgAlt,
          borderRadius: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* clear-space dashed box */}
        <div
          style={{
            position: "absolute",
            inset: 30,
            border: `1px dashed ${T.inkDim}`,
            borderRadius: 8,
          }}
        />
        <RouteMark size={140} holdColor="#7a7a7e" ringWidth={2.2} />
      </div>
    </Frame>
  );
}

// ===========================================================================
// 7. On-coral / mono variants
// ===========================================================================
function MonoVariants() {
  return (
    <Frame label="Mono fallbacks" caption="When color is off the table — print, embroidery, single-channel.">
      <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
        <div style={{ background: T.ink, borderRadius: 16, padding: 18 }}>
          <RouteMonoMark stroke={T.bg} hold="#1d1d20" />
        </div>
        <div style={{ background: T.bg, borderRadius: 16, padding: 18, border: `1px solid ${T.bgAlt}` }}>
          <RouteMonoMark stroke={T.ink} hold="#5a5a5e" />
        </div>
        <div style={{ background: T.coral, borderRadius: 16, padding: 18 }}>
          <RouteMonoMark stroke={T.ink} hold="#7a2a24" />
        </div>
      </div>
    </Frame>
  );
}
function RouteMonoMark({ stroke, hold }) {
  const moves = [
    { cx: 28, cy: 10, rot: -8, rx: 4, ry: 2.8 },
    { cx: 46, cy: 26, rot: 18, rx: 4, ry: 2.8 },
    { cx: 18, cy: 38, rot: -22, rx: 3.6, ry: 2.6 },
    { cx: 32, cy: 54, rot: 5, rx: 4, ry: 2.8 },
  ];
  return (
    <svg width="80" height="80" viewBox="0 0 64 64">
      {moves.map((m, i) => (
        <g key={i}>
          <ellipse cx={m.cx} cy={m.cy} rx={m.rx} ry={m.ry} fill={hold} transform={`rotate(${m.rot} ${m.cx} ${m.cy})`} />
          <circle cx={m.cx} cy={m.cy} r={9} fill="none" stroke={stroke} strokeWidth={2.2} />
        </g>
      ))}
    </svg>
  );
}

// ===========================================================================
// 8. Browser tab / favicon mockup
// ===========================================================================
function FaviconMockup() {
  return (
    <Frame label="In context — browser tabs" caption="boardsesh.com in the wild.">
      <div
        style={{
          background: "#1f1f23",
          borderRadius: 8,
          padding: "8px 6px 0",
          width: 360,
        }}
      >
        {[
          ["boardsesh — Track your sends", true],
          ["Kilter Climbs at 9°", false],
          ["You | Boardsesh", false],
        ].map(([title, active], i) => (
          <div
            key={i}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: active ? T.bg : "transparent",
              padding: "8px 10px",
              borderTopLeftRadius: 8,
              borderTopRightRadius: 8,
              marginRight: 4,
              maxWidth: 160,
            }}
          >
            <div style={{ width: 14, height: 14, flex: "0 0 14px" }}>
              <RouteMarkScalable holdColor="#5a5a5e" showContext={false} ringWidth={3} />
            </div>
            <span
              style={{
                fontSize: 11,
                color: active ? T.ink : T.inkDim,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {title}
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

// ===========================================================================
// STICKERS — marketing
// ===========================================================================

// 9. Round die-cut sticker — primary
function StickerRound() {
  return (
    <Frame label="Sticker — round die-cut" bg="#f4f1ea" caption="3 inch round die-cut. Primary brand sticker.">
      <div
        style={{
          width: 220,
          height: 220,
          borderRadius: "50%",
          background: T.bg,
          border: `8px solid ${T.ink}`,
          boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          position: "relative",
        }}
      >
        <RouteMark size={108} holdColor="#7a7a7e" ringWidth={2.5} />
        <div style={{ ...display, fontSize: 24, color: T.ink, lineHeight: 1 }}>boardsesh</div>
      </div>
    </Frame>
  );
}

// 10. Slap sticker — bumper / bouldering pad
function StickerSlap() {
  return (
    <Frame label="Slap sticker" bg="#f4f1ea" caption="Bumper / bouldering pad / laptop. Big and loud.">
      <div
        style={{
          background: T.coral,
          padding: "16px 26px",
          borderRadius: 14,
          display: "flex",
          alignItems: "center",
          gap: 14,
          transform: "rotate(-3deg)",
          boxShadow: "0 8px 22px rgba(0,0,0,0.18)",
          border: `5px solid ${T.ink}`,
        }}
      >
        <RouteMark size={56} holdColor="#7a2a24" ringWidth={2.6} />
        <div style={{ ...display, fontSize: 38, color: T.ink, lineHeight: 1 }}>boardsesh</div>
      </div>
    </Frame>
  );
}

// 11. Tagline sticker
function StickerTagline() {
  return (
    <Frame label="Sticker — tagline" bg="#f4f1ea" caption="Slogan-forward. For events and gym partners.">
      <div
        style={{
          background: T.bg,
          color: T.ink,
          padding: "28px 36px",
          borderRadius: 18,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          border: `4px dashed ${T.inkDim}`,
        }}
      >
        <RouteMark size={48} holdColor="#7a7a7e" ringWidth={2.6} />
        <div style={{ ...display, fontSize: 28, color: T.ink, lineHeight: 0.95, textAlign: "center" }}>
          send harder.<br />send together.
        </div>
        <div style={{ ...mono, fontSize: 10, color: T.inkDim, letterSpacing: "0.2em" }}>
          BOARDSESH.COM
        </div>
      </div>
    </Frame>
  );
}

// 12. Board-specific stickers (one per supported board)
function StickerBoardSet() {
  const boards = ["KILTER", "TENSION", "MOONBOARD", "DECOY", "GRASSHOPPER"];
  return (
    <Frame label="Sticker pack — board-specific" bg="#f4f1ea" caption="One per supported board. Collect 'em all.">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", maxWidth: 360 }}>
        {boards.map((b, i) => (
          <div
            key={i}
            style={{
              background: T.bg,
              color: T.ink,
              padding: "10px 14px",
              borderRadius: 999,
              border: `2px solid ${T.ink}`,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div style={{ width: 18, height: 18 }}>
              <RouteMarkScalable holdColor="#5a5a5e" ringWidth={2.6} showContext={false} />
            </div>
            <span style={{ ...display, fontSize: 13, letterSpacing: "0.05em" }}>{b}</span>
          </div>
        ))}
        <div
          style={{
            background: T.coral,
            color: T.ink,
            padding: "10px 14px",
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ ...display, fontSize: 13, letterSpacing: "0.05em" }}>+ MORE</span>
        </div>
      </div>
    </Frame>
  );
}

// 13. Send-it sticker — V-grade celebration
function StickerSent() {
  return (
    <Frame label="Sticker — SENT" bg="#f4f1ea" caption="Reward sticker. Hand out at gym launches.">
      <div
        style={{
          width: 220,
          height: 220,
          borderRadius: "50%",
          background: T.coral,
          border: `8px solid ${T.ink}`,
          boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        }}
      >
        <div style={{ ...display, fontSize: 64, color: T.ink, lineHeight: 0.9 }}>SENT</div>
        <div style={{ ...mono, fontSize: 10, color: T.ink, letterSpacing: "0.3em", opacity: 0.85 }}>
          BOARDSESH ·
        </div>
      </div>
    </Frame>
  );
}

// 14. Long landscape sticker — bumper
function StickerBumper() {
  return (
    <Frame label="Bumper sticker" bg="#f4f1ea" caption="11 × 3 in. Wide format.">
      <div
        style={{
          background: T.bg,
          padding: "14px 22px",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          gap: 16,
          border: `3px solid ${T.ink}`,
          boxShadow: "0 6px 18px rgba(0,0,0,0.14)",
        }}
      >
        <RouteMark size={42} holdColor="#7a7a7e" ringWidth={2.6} />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ ...display, fontSize: 22, color: T.ink, lineHeight: 1 }}>I'd rather be on the boardsesh.</div>
          <div style={{ ...mono, fontSize: 9, color: T.inkDim, letterSpacing: "0.2em" }}>
            BOARDSESH.COM · TRACK · TRAIN · CLIMB TOGETHER
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ===========================================================================
// USE-CASES
// ===========================================================================

// 15. T-shirt
function UseTShirt() {
  return (
    <Frame label="Apparel" caption="Front pocket print, single-color.">
      <div
        style={{
          width: 240,
          height: 280,
          background: "#1a1a1c",
          borderRadius: "60px 60px 30px 30px / 30px 30px 30px 30px",
          position: "relative",
          padding: 36,
          boxShadow: "inset 0 -40px 60px rgba(0,0,0,0.3), 0 12px 30px rgba(0,0,0,0.4)",
        }}
      >
        {/* sleeves */}
        <div style={{ position: "absolute", left: -28, top: 12, width: 60, height: 80, background: "#1a1a1c", borderRadius: "40px 0 30px 60px", transform: "rotate(-12deg)" }} />
        <div style={{ position: "absolute", right: -28, top: 12, width: 60, height: 80, background: "#1a1a1c", borderRadius: "0 40px 60px 30px", transform: "rotate(12deg)" }} />
        {/* neck */}
        <div style={{ position: "absolute", left: "50%", top: 8, transform: "translateX(-50%)", width: 60, height: 22, background: "#0a0a0c", borderRadius: "0 0 40px 40px" }} />
        {/* print */}
        <div style={{ marginTop: 60, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <RouteMark size={64} holdColor="#3a3a3e" ringWidth={2.4} />
          <div style={{ ...display, fontSize: 18, color: T.ink }}>boardsesh</div>
        </div>
      </div>
    </Frame>
  );
}

// 16. Phone splash
function UseSplash() {
  return (
    <Frame label="App splash" caption="Cold-start screen.">
      <div
        style={{
          width: 200,
          height: 360,
          background: T.bg,
          borderRadius: 32,
          border: `8px solid #1a1a1c`,
          boxShadow: "0 12px 30px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          position: "relative",
        }}
      >
        <RouteMark size={88} holdColor="#7a7a7e" ringWidth={2.4} />
        <div style={{ ...display, fontSize: 24, color: T.ink, lineHeight: 1 }}>boardsesh</div>
        <div style={{ position: "absolute", bottom: 18, ...mono, fontSize: 9, color: T.inkDim, letterSpacing: "0.2em" }}>
          v1.0
        </div>
      </div>
    </Frame>
  );
}

// 17. Discord avatar / social profile
function UseSocial() {
  return (
    <Frame label="Social — avatar + banner" caption="Discord, X, IG.">
      <div style={{ display: "flex", flexDirection: "column", gap: 0, width: 320 }}>
        <div
          style={{
            height: 90,
            background: T.bg,
            borderRadius: "12px 12px 0 0",
            position: "relative",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            paddingRight: 22,
          }}
        >
          <div style={{ ...display, fontSize: 26, color: T.ink, lineHeight: 1 }}>boardsesh</div>
          <div style={{ ...mono, fontSize: 9, color: T.inkDim, position: "absolute", right: 22, bottom: 14, letterSpacing: "0.2em" }}>
            TRACK · TRAIN · CLIMB
          </div>
        </div>
        <div
          style={{
            height: 60,
            background: T.bgAlt,
            borderRadius: "0 0 12px 12px",
            position: "relative",
            paddingLeft: 100,
            display: "flex",
            alignItems: "center",
            color: T.ink,
            fontSize: 12,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 18,
              top: -34,
              width: 76,
              height: 76,
              borderRadius: "50%",
              background: T.bg,
              border: `4px solid ${T.bgAlt}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 6,
              boxSizing: "border-box",
            }}
          >
            <RouteMarkScalable holdColor="#5a5a5e" ringWidth={2.5} showContext={true} />
          </div>
          <div>
            <div style={{ ...display, fontSize: 14 }}>@boardsesh</div>
            <div style={{ ...mono, fontSize: 10, color: T.inkDim }}>boardsesh.com</div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

// 18. Print: business card
function UseCard() {
  return (
    <Frame label="Card — front / back" caption="3.5 × 2 in.">
      <div style={{ display: "flex", gap: 14 }}>
        <div
          style={{
            width: 200,
            height: 116,
            background: T.bg,
            borderRadius: 8,
            padding: 18,
            boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <RouteMark size={32} holdColor="#7a7a7e" ringWidth={2.6} />
          <div>
            <div style={{ ...display, fontSize: 18, color: T.ink, lineHeight: 1 }}>boardsesh</div>
            <div style={{ ...mono, fontSize: 8, color: T.inkDim, letterSpacing: "0.18em", marginTop: 4 }}>
              TRACK · TRAIN · CLIMB TOGETHER
            </div>
          </div>
        </div>
        <div
          style={{
            width: 200,
            height: 116,
            background: T.coral,
            borderRadius: 8,
            padding: 18,
            boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
            color: T.ink,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ ...mono, fontSize: 9, letterSpacing: "0.18em" }}>HELLO@</div>
          <div>
            <div style={{ ...display, fontSize: 14 }}>boardsesh.com</div>
            <div style={{ ...mono, fontSize: 9, opacity: 0.8 }}>discord.gg/boardsesh</div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ===========================================================================
// Export
// ===========================================================================
Object.assign(window, {
  AppIcons,
  AppIconScale,
  LockupHorizontal,
  LockupStacked,
  LockupCompact,
  ClearSpace,
  MonoVariants,
  FaviconMockup,
  StickerRound,
  StickerSlap,
  StickerTagline,
  StickerBoardSet,
  StickerSent,
  StickerBumper,
  UseTShirt,
  UseSplash,
  UseSocial,
  UseCard,
});
