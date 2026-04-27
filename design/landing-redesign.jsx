// Redesigned landing screen mock for boardsesh.com.
// Lifts the visual DNA of the v8 logo work — V11–V17 purples, black-circle tile,
// Archivo Black wordmark — and applies it to the actual landing page from the
// user's screenshot. Wrapped in a Mac browser frame so it reads as "what the
// site looks like."

function ConceptLandingRedesign({ cta = 'purple' } = {}) {
  // CTA palette options. Rose = aligned with current tokens.primary; purple = brand-forward.
  const ctaPalettes = {
    rose: { bg: '#8C4A52', shadow: 'rgba(140, 74, 82, 0.30)', label: 'tokens.primary' },
    purple: { bg: '#6A1B9A', shadow: 'rgba(106, 27, 154, 0.32)', label: 'grades.v13' },
  };
  const ctaPalette = ctaPalettes[cta] || ctaPalettes.rose;
  // Board catalogue — solid colour tiles in place of LED noise photos.
  // Colours pulled from each manufacturer's brand palette, plus the
  // V-grade purple range we're using for boardsesh itself.
  const BOARDS = [
    { name: 'Kilter', sub: '12×12 Original', bg: '#1F8A3F', route: 'kilter' }, // Kilter green
    { name: 'Kilter', sub: '10×12 Homewall', bg: '#157A35', route: 'kilter' },
    { name: 'Tension', sub: '12×10 Spray', bg: '#C8341F', route: 'tension' }, // Tension red
    { name: 'Tension', sub: '8×10 Mini', bg: '#A82A19', route: 'tension' },
    { name: 'MoonBoard', sub: '2019 Master', bg: '#1F4FB8', route: 'moonboard' }, // Moon blue
    { name: 'MoonBoard', sub: '2017 Original', bg: '#1A3F95', route: 'moonboard' },
    { name: 'Decoy', sub: '10×10', bg: '#5B2A8C', route: 'purple' },
    { name: 'Grasshopper', sub: '12×12', bg: '#3E2570', route: 'purple' },
    { name: 'Aurora', sub: 'Spray 12×12', bg: '#7A1E66', route: 'purple' },
    { name: 'Custom', sub: 'Add your wall', bg: '#2a2530', route: 'custom' },
  ];

  return (
    <FrameP
      label={`U — Landing redesign · ${cta} CTA`}
      caption={`CTA = ${ctaPalette.label}. Same content, brand-applied: hero lockup, color-tile boards, icon-led action cards.`}
      bg="#0a0a0c"
    >
      <BrowserShell>
        <LandingBody boards={BOARDS} ctaPalette={ctaPalette} />
      </BrowserShell>
    </FrameP>
  );
}

// ----- Mac browser chrome (lightweight, no starter) -------------------------
function BrowserShell({ children }) {
  return (
    <div
      style={{
        width: 1100,
        borderRadius: 12,
        overflow: 'hidden',
        background: '#0e0e10',
        boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px #1f1f23',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Title bar */}
      <div
        style={{
          height: 36,
          background: 'linear-gradient(#2a2a2f, #1c1c20)',
          borderBottom: '1px solid #0a0a0c',
          display: 'flex',
          alignItems: 'center',
          padding: '0 14px',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span style={{ width: 12, height: 12, borderRadius: 6, background: '#ff5f57' }} />
        <span style={{ width: 12, height: 12, borderRadius: 6, background: '#febc2e' }} />
        <span style={{ width: 12, height: 12, borderRadius: 6, background: '#28c840' }} />
        <div
          style={{
            flex: 1,
            marginLeft: 80,
            marginRight: 80,
            background: '#0e0e10',
            borderRadius: 6,
            padding: '5px 12px',
            ...mono8,
            fontSize: 11,
            color: '#8a8780',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <BlackTile size={14} radius={3} />
          <span>www.boardsesh.com</span>
        </div>
      </div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

// ----- The page body --------------------------------------------------------
function LandingBody({ boards, ctaPalette }) {
  return (
    <div
      style={{
        background: '#0e0e10' /* tokens.background.dark */,
        color: T8.ink,
        padding: '0 0 32px 0',
      }}
    >
      {/* Floating avatar — top right only */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 24px' }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            background: '#282828' /* tokens.surfaceElevated.dark */,
            border: '1px solid #333333' /* tokens.neutral.dark.200 */,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...mono8,
            fontSize: 11,
            color: T8.inkDim,
          }}
        >
          JF
        </div>
      </div>

      {/* Hero */}
      <div
        style={{
          padding: '36px 24px 28px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
        }}
      >
        <BlackTile size={130} radius={29} />
        <div style={{ ...heavy8, fontSize: 44, color: T8.ink, lineHeight: 0.95, letterSpacing: '-0.04em' }}>
          Get on the board.
        </div>
        <div style={{ ...display8, fontSize: 16, color: T8.inkDim, maxWidth: 480, lineHeight: 1.4, fontWeight: 500 }}>
          Track your sends across Kilter, Tension, and MoonBoard — all in one place.
        </div>
        <button
          style={{
            marginTop: 4,
            background: ctaPalette.bg,
            color: '#f4f1ea',
            border: 'none',
            padding: '13px 28px',
            borderRadius: 8,
            ...heavy8,
            fontSize: 14,
            letterSpacing: '-0.01em',
            cursor: 'pointer',
            boxShadow: `0 4px 16px ${ctaPalette.shadow}`,
          }}
        >
          ▶ Start climbing
        </button>
      </div>

      {/* Boards near you */}
      <div style={{ padding: '24px 24px 0' }}>
        <div
          style={{
            ...mono8,
            fontSize: 10,
            color: T8.inkDim,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          Boards near you
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 12,
          }}
        >
          {boards.slice(0, 10).map((b, i) => (
            <BoardCard key={i} board={b} />
          ))}
        </div>
      </div>

      {/* Make it yours */}
      <div style={{ padding: '32px 24px 0' }}>
        <div
          style={{
            ...mono8,
            fontSize: 10,
            color: T8.inkDim,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          Make it yours
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ActionCard
            iconKind="tile"
            title="Get the Boardsesh app"
            sub="Light up holds on your board straight from your phone."
          />
          <ActionCard
            iconKind="route"
            routePalette="kilter"
            title="Take the tour"
            sub="A two-minute walkthrough of climbing, logging, and sessions with your crew."
          />
          <ActionCard
            iconKind="route"
            routePalette="moonboard"
            title="Coming from Kilter or MoonBoard?"
            sub="Bring your sends and history over in one click."
          />
          <ActionCard
            iconKind="route"
            routePalette="tension"
            title="Find your crew"
            sub="Follow friends and see what they're climbing."
          />
        </div>
      </div>

      {/* Bottom tab bar */}
      <div
        style={{
          marginTop: 32,
          padding: '12px 24px',
          borderTop: '1px solid #222222' /* tokens.neutral.dark.100 */,
          display: 'flex',
          justifyContent: 'space-around',
          ...mono8,
          fontSize: 10,
          color: T8.inkDim,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        {['Home', 'Climb', 'Log', 'Crew', 'Profile'].map((t, i) => (
          <div key={t} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                background: i === 0 ? ctaPalette.bg : 'transparent',
                border: i === 0 ? 'none' : '1.5px solid #333333',
              }}
            />
            <span style={{ color: i === 0 ? T8.ink : T8.inkDim }}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----- Board card: solid color tile + 4-circle route mark -------------------
function BoardCard({ board }) {
  const palettes = {
    kilter: KILTER_PALETTE,
    tension: TENSION_PALETTE,
    moonboard: MOONBOARD_PALETTE,
    purple: { start: '#fff', hand: '#fff', foot: '#fff', finish: '#fff' },
    custom: null,
  };
  const palette = palettes[board.route];

  return (
    <div
      style={{
        background: board.bg,
        borderRadius: 10,
        aspectRatio: '0.85',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Mini route diagram in top half — 4 circles in a zig-zag */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {board.route === 'custom' ? (
          <div style={{ ...heavy8, fontSize: 28, color: T8.inkDim, lineHeight: 1 }}>+</div>
        ) : (
          <RouteMini palette={palette} />
        )}
      </div>
      {/* Label */}
      <div>
        <div style={{ ...heavy8, fontSize: 12, color: '#fff', lineHeight: 1.05, letterSpacing: '-0.02em' }}>
          {board.name}
        </div>
        <div style={{ ...mono8, fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{board.sub}</div>
      </div>
    </div>
  );
}

// Tiny 4-circle route diagram for the board cards.
function RouteMini({ palette }) {
  if (!palette) return null;
  // 4 circles, zig-zag, sized for ~80px area
  const dots = [
    { cx: 14, cy: 50, color: palette.start, stroke: '#000' }, // start (BL)
    { cx: 30, cy: 28, color: palette.hand, stroke: '#000' }, // hand
    { cx: 46, cy: 44, color: palette.foot, stroke: '#000' }, // foot
    { cx: 60, cy: 16, color: palette.finish, stroke: '#000' }, // finish (TR)
  ];
  return (
    <svg width={70} height={56} viewBox="0 0 74 60" fill="none">
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.cx}
          cy={d.cy}
          r={7}
          fill={d.color}
          fillOpacity={0.85}
          stroke={d.stroke}
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
}

// ----- Action card with brand iconography -----------------------------------
function ActionCard({ iconKind, routePalette, title, sub }) {
  return (
    <div
      style={{
        background: '#1A1A1A' /* tokens.surface.dark */,
        border: '1px solid #222222' /* tokens.neutral.dark.100 */,
        borderRadius: 10,
        padding: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: '#0e0e10',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {iconKind === 'tile' ? <BlackTile size={32} radius={7} /> : <ActionRouteIcon palette={routePalette} />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ ...heavy8, fontSize: 14, color: T8.ink, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
          {title}
        </div>
        <div style={{ ...display8, fontSize: 12, color: T8.inkDim, marginTop: 3, lineHeight: 1.35, fontWeight: 500 }}>
          {sub}
        </div>
      </div>
      <div style={{ color: T8.inkDim, fontSize: 14, paddingRight: 4 }}>›</div>
    </div>
  );
}

function ActionRouteIcon({ palette }) {
  const palettes = {
    kilter: KILTER_PALETTE,
    tension: TENSION_PALETTE,
    moonboard: MOONBOARD_PALETTE,
  };
  const p = palettes[palette] || KILTER_PALETTE;
  return (
    <svg width={28} height={28} viewBox="0 0 32 32" fill="none">
      <circle cx={6} cy={24} r={4} fill={p.start} fillOpacity={0.9} stroke="#000" strokeWidth={1.2} />
      <circle cx={14} cy={12} r={4} fill={p.hand} fillOpacity={0.9} stroke="#000" strokeWidth={1.2} />
      <circle cx={22} cy={22} r={4} fill={p.foot} fillOpacity={0.9} stroke="#000" strokeWidth={1.2} />
      <circle cx={26} cy={8} r={4} fill={p.finish} fillOpacity={0.9} stroke="#000" strokeWidth={1.2} />
    </svg>
  );
}

Object.assign(window, {
  ConceptLandingRedesign,
});
