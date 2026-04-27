const T8 = {
  bg: '#0e0e10',
  bgTile: '#101012',
  ink: '#f4f1ea',
  inkDim: '#8a8780',
  start: '#c44a8a',
  hand: '#3fb8c4',
  foot: '#5fb27a',
  finish: '#e2a44d',
  coral: '#d65a4f',
};
const heavy8 = { fontFamily: '"Archivo Black", "Archivo", sans-serif', fontWeight: 900, letterSpacing: '-0.04em' };
const display8 = { fontFamily: '"Archivo", sans-serif', fontWeight: 800, letterSpacing: '-0.025em' };
const mono8 = { fontFamily: '"JetBrains Mono", monospace' };

function hexToRgba(hex, alpha) {
  // HSL passthrough — wrap in hsla() if it's an hsl(...) string
  if (typeof hex === 'string' && hex.startsWith('hsl(')) {
    return hex.replace(/^hsl\(/, 'hsla(').replace(/\)$/, `, ${alpha})`);
  }
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function FrameP({ label, caption, children, bg = T8.bg }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: bg,
        color: T8.ink,
        padding: 32,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ ...mono8, fontSize: 10, color: T8.inkDim, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 14 }}>
        {children}
      </div>
      <div style={{ ...mono8, fontSize: 10, color: T8.inkDim, borderTop: '1px solid #1f1f23', paddingTop: 10 }}>
        {caption}
      </div>
    </div>
  );
}

// Portrait board pattern — 64 wide × 116 tall, designed to fit naturally inside a
// portrait phone screen with no stretching. ~7 rows of holds.
const BOARD = [
  // row 1
  [12, 12, 3.4, 2.2, -10],
  [30, 10, 3.2, 2.0, 18],
  [48, 14, 3.6, 2.4, -8],
  // row 2
  [56, 26, 3.0, 2.0, 22],
  [38, 24, 3.2, 2.2, 5],
  [20, 26, 3.0, 2.0, -22],
  // row 3
  [10, 38, 3.4, 2.2, 14],
  [30, 40, 3.2, 2.2, -5],
  [50, 38, 3.0, 2.0, 25],
  // row 4
  [18, 54, 3.2, 2.2, -16],
  [40, 52, 3.4, 2.2, 10],
  [54, 56, 3.0, 2.0, 30],
  // row 5
  [10, 68, 3.2, 2.2, 6],
  [28, 68, 3.6, 2.4, -12],
  [46, 68, 3.2, 2.2, 18],
  // row 6
  [18, 82, 3.0, 2.0, -8],
  [38, 84, 3.4, 2.2, 22],
  [54, 80, 3.2, 2.2, -14],
  // row 7
  [12, 96, 3.6, 2.4, 4],
  [30, 100, 3.2, 2.2, -20],
  [50, 98, 3.0, 2.0, 12],
  // row 8 (kicker)
  [22, 110, 3.2, 2.2, -6],
  [42, 108, 3.0, 2.0, 16],
];
// Routes — each one zig-zags across the board, hitting 4 distinct quadrants.
// All four are visually distinct: no two share a hold, and none reads as a straight line.
// Board is laid out in 8 rows × ~3 cols, indices 0..22.
//   row 0: [0,1,2]    row 4: [12,13,14]
//   row 1: [3,4,5]    row 5: [15,16,17]
//   row 2: [6,7,8]    row 6: [18,19,20]
//   row 3: [9,10,11]  row 7: [21,22]
// Reading the climb from the phone's bottom up, the holds should be:
// foot (lowest) → start → hand → finish (highest).
// Board y=0 is top, y=116 is bottom — so sorted by y DESC: foot, start, hand, finish.
// Indices below are picked so that, when sorted by descending y, the role sequence is correct.
const ROUTES_8 = [
  // Route 0 (TL phone) — zig-zag BL → MR → UL → TR
  // 21 (x=12,y=96, foot) → 17 (x=46,y=68, start) → 6 (x=10,y=38, hand) → 2 (x=48,y=14, finish)
  [
    [21, 'foot'],
    [17, 'start'],
    [6, 'hand'],
    [2, 'finish'],
  ],
  // Route 1 (TR phone) — zig-zag BR → ML → UR → TC
  // 22 (x=42,y=108, foot) → 9 (x=10,y=40, start) → 8 (x=50,y=38, hand) → 1 (x=30,y=10, finish)
  [
    [22, 'foot'],
    [9, 'start'],
    [8, 'hand'],
    [1, 'finish'],
  ],
  // Route 2 (BL phone)
  // 19 (y=100, foot) → 14 (y=68, start) → 5 (y=24, hand) → 1 (y=10, finish)
  [
    [19, 'foot'],
    [14, 'start'],
    [5, 'hand'],
    [1, 'finish'],
  ],
  // Route 3 (BR phone)
  // 20 (y=98, foot) → 12 (y=68, start) → 10 (y=52, hand) → 0 (y=10, finish)
  [
    [20, 'foot'],
    [12, 'start'],
    [10, 'hand'],
    [0, 'finish'],
  ],
];

// ============================================================
// PHONE — stylised mini phone with a climb on the screen.
// All measurements relative to a 100×190 viewBox. Caller scales.
// ============================================================
function MiniPhone({
  routeIdx,
  screenBg,
  scale = 1,
  holdContext = '#3f3f46',
  holdRouted = '#7a7a7e',
  circleColor,
  palette,
  fillFromPalette = false,
  strokeOverride,
  opacityShift = false,
  opacityShiftColor = null,
  opacityShiftAlpha = 0.55,
}) {
  const W = 100,
    H = 190;
  const route = ROUTES_8[routeIdx];
  const ringedSet = new Set(route.map(([i]) => i));
  // Screen rect: x=6, y=14, w=88, h=162. Portrait board is 64×116 — uniform fit, circles stay round.
  const SX = 6,
    SY = 14,
    SW = W - 12,
    SH = H - 28;
  const BW = 64,
    BH = 116;
  const padX = 4,
    padY = 6;
  const scaleFit = Math.min((SW - padX * 2) / BW, (SH - padY * 2) / BH);
  const climbW = BW * scaleFit;
  const climbH = BH * scaleFit;
  const climbX = SX + (SW - climbW) / 2;
  const climbY = SY + (SH - climbH) / 2;
  return (
    <svg width={W * scale} height={H * scale} viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <clipPath id={`screen-${routeIdx}-${scale}`}>
          <rect x={SX} y={SY} width={SW} height={SH} rx="6" ry="6" />
        </clipPath>
      </defs>
      {/* phone body */}
      <rect x="2" y="2" width={W - 4} height={H - 4} rx="14" ry="14" fill="#1a1a1d" stroke="#2a2a2e" strokeWidth="1" />
      {/* screen background — V-grade tint goes here */}
      <rect x={SX} y={SY} width={SW} height={SH} rx="6" ry="6" fill={screenBg} />
      {/* climb fills the screen, clipped to screen rect */}
      <g clipPath={`url(#screen-${routeIdx}-${scale})`}>
        <g transform={`translate(${climbX} ${climbY}) scale(${scaleFit})`}>
          {BOARD.map(([cx, cy, rx, ry, rot], i) => (
            <ellipse
              key={i}
              cx={cx}
              cy={cy}
              rx={rx * 1.0}
              ry={ry * 1.0}
              fill={ringedSet.has(i) ? holdRouted : holdContext}
              transform={`rotate(${rot} ${cx} ${cy})`}
            />
          ))}
          {route.map(([k, role], idx) => {
            const [cx, cy] = BOARD[k];
            const paletteColor = (palette && palette[role]) || T8[role];
            // Mode priority: opacityShift > fillFromPalette > stroke-only
            let stroke, fill;
            if (opacityShift) {
              // Overlay white at moderate alpha → "lifted" disc reading on the deep purple,
              // same hue family but brighter tone.
              const shiftHex = opacityShiftColor || '#ffffff';
              stroke = strokeOverride || '#0a0a0c';
              fill = hexToRgba(shiftHex, opacityShiftAlpha);
            } else if (fillFromPalette) {
              stroke = strokeOverride || '#0a0a0c';
              fill = hexToRgba(paletteColor, 0.6);
            } else {
              stroke = circleColor || paletteColor;
              fill = 'none';
            }
            return <circle key={idx} cx={cx} cy={cy} r={9.5} fill={fill} stroke={stroke} strokeWidth={2.8} />;
          })}
        </g>
      </g>
      {/* notch */}
      <rect x={W / 2 - 11} y="6" width="22" height="5" rx="2.5" fill="#0a0a0c" />
      {/* home indicator */}
      <rect x={W / 2 - 12} y={H - 9} width="24" height="2" rx="1" fill="#3a3a3e" />
    </svg>
  );
}

// ============================================================
// FOUR PHONES — pointing inward diagonally, sword-tile style.
// Each phone's top edge faces the center. Screens carry the V-grade tint.
// ============================================================
function FourPhonesIcon({
  size = 320,
  radius = 22,
  tile = T8.bgTile,
  phoneBgs,
  circleColor,
  palette,
  fillFromPalette = false,
  strokeOverride,
  opacityShift = false,
  opacityShiftAlpha = 0.55,
}) {
  const defaultBgs = [
    'hsl(14, 25%, 22%)', // V3 orange — top-left
    'hsl(11, 25%, 22%)', // V4 orange-red — top-right
    'hsl(342, 25%, 22%)', // V10 pink-red — bottom-left
    'hsl(291, 25%, 22%)', // V11 magenta-purple — bottom-right
  ];
  const bgs = phoneBgs || defaultBgs;

  // Each phone is rotated so its TOP edge (where the notch is) points to the
  // tile center. Quadrants:
  //   TL: rotate +135° (top points down-right toward center)
  //   TR: rotate -135° (top points down-left toward center)
  //   BL: rotate  +45° (top points up-right toward center)
  //   BR: rotate  -45° (top points up-left toward center)
  // Phones placed with their bottom-center anchored at quadrant outer corners,
  // then rotated so they "lean in" toward the middle.
  const rotations = [135, -135, 45, -45];
  // Quadrant offsets in unit space (0..1 of size). Center each phone in its quadrant.
  const positions = [
    { cx: 0.3, cy: 0.3 },
    { cx: 0.7, cy: 0.3 },
    { cx: 0.3, cy: 0.7 },
    { cx: 0.7, cy: 0.7 },
  ];

  // Phone aspect 100×190. Pick a length that fits neatly within a half-tile
  // when rotated 45° — the diagonal extent matters most.
  const phoneH = size * 0.42;
  const phoneW = phoneH * (100 / 190);

  // Render the SVG at a CONSTANT reference size (large), then CSS-scale the
  // whole rotated quadrant down. This keeps stroke widths and corner radii
  // visually proportional even at 16/24/32px tile sizes — without this, the
  // 1px SVG strokes don't shrink and the phones appear to drift apart.
  const REF_PHONE_H = 190; // matches the SVG viewBox height
  const REF_PHONE_W = 100;
  const refToActual = phoneH / REF_PHONE_H;

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        background: tile,
        borderRadius: radius,
        overflow: 'hidden',
      }}
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: positions[i].cx * size,
            top: positions[i].cy * size,
            width: 0,
            height: 0,
          }}
        >
          <div
            style={{
              width: REF_PHONE_W,
              height: REF_PHONE_H,
              transform: `translate(-50%, -50%) scale(${refToActual}) rotate(${rotations[i]}deg)`,
              transformOrigin: '50% 50%',
            }}
          >
            <MiniPhone
              routeIdx={i}
              screenBg={bgs[i]}
              scale={1}
              circleColor={circleColor}
              palette={palette}
              fillFromPalette={fillFromPalette}
              strokeOverride={strokeOverride}
              opacityShift={opacityShift}
              opacityShiftAlpha={opacityShiftAlpha}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ConceptFourPhones() {
  return (
    <FrameP
      label="A — Four phones, four climbers"
      caption="One board, four climbers — each on their phone, sharing the sesh."
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        <FourPhonesIcon size={340} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...heavy8, fontSize: 56, color: T8.ink, lineHeight: 0.9 }}>boardsesh</div>
          <div style={{ ...mono8, fontSize: 11, color: T8.inkDim, marginTop: 10, letterSpacing: '0.18em' }}>
            ONE BOARD · YOUR CREW
          </div>
        </div>
      </div>
    </FrameP>
  );
}

// Variant: phones overlap toward center — tighter, more "huddle" feeling
function FourPhonesHuddle({ size = 340 }) {
  const bgs = ['hsl(14, 25%, 22%)', 'hsl(11, 25%, 22%)', 'hsl(342, 25%, 22%)', 'hsl(291, 25%, 22%)'];
  const rotations = [135, -135, 45, -45];
  const positions = [
    { cx: 0.34, cy: 0.34 },
    { cx: 0.66, cy: 0.34 },
    { cx: 0.34, cy: 0.66 },
    { cx: 0.66, cy: 0.66 },
  ];
  const phoneH = size * 0.5;
  const phoneW = phoneH * (100 / 190);
  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        background: T8.bgTile,
        borderRadius: 24,
        overflow: 'hidden',
      }}
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: positions[i].cx * size - phoneW / 2,
            top: positions[i].cy * size - phoneH / 2,
            width: phoneW,
            height: phoneH,
            transform: `rotate(${rotations[i]}deg)`,
          }}
        >
          <MiniPhone routeIdx={i} screenBg={bgs[i]} scale={phoneW / 100} />
        </div>
      ))}
    </div>
  );
}

function ConceptFourPhonesHuddle() {
  return (
    <FrameP label="B — Tighter huddle" caption="Phones overlap inward — more compact, more 'showing each other'.">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        <FourPhonesHuddle size={340} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...heavy8, fontSize: 56, color: T8.ink, lineHeight: 0.9 }}>boardsesh</div>
          <div style={{ ...mono8, fontSize: 11, color: T8.inkDim, marginTop: 10, letterSpacing: '0.18em' }}>
            ONE BOARD · YOUR CREW
          </div>
        </div>
      </div>
    </FrameP>
  );
}

// Solid colour variant — full saturation V-grade screens (V3 / V4 / V10 / V11)
function ConceptFourPhonesSolid() {
  const bgs = ['#FF7043', '#FF5722', '#A11B4A', '#9C27B0'];
  return (
    <FrameP label="C — Solid V-grade screens (V3–V11)" caption="Full saturation V-grade colours filling each screen.">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        <FourPhonesIcon size={340} phoneBgs={bgs} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...heavy8, fontSize: 56, color: T8.ink, lineHeight: 0.9 }}>boardsesh</div>
          <div style={{ ...mono8, fontSize: 11, color: T8.inkDim, marginTop: 10, letterSpacing: '0.18em' }}>
            ONE BOARD · YOUR CREW
          </div>
        </div>
      </div>
    </FrameP>
  );
}

// Solid colour variant — V11–V17 (the purple-to-indigo range, top of the scale)
function ConceptFourPhonesPurples() {
  // V11 magenta-purple, V13 purple, V14 deep purple, V15 indigo-blue.
  // Picked for hue spread across the upper V-grade range.
  const bgs = ['#9C27B0', '#6A1B9A', '#4A148C', '#3F51B5'];
  return (
    <FrameP label="D — Solid V-grade screens (V11–V17)" caption="The upper V-grade range — magenta through indigo.">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        <FourPhonesIcon size={340} phoneBgs={bgs} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...heavy8, fontSize: 56, color: T8.ink, lineHeight: 0.9 }}>boardsesh</div>
          <div style={{ ...mono8, fontSize: 11, color: T8.inkDim, marginTop: 10, letterSpacing: '0.18em' }}>
            EVERY CLIMB · YOUR CREW
          </div>
        </div>
      </div>
    </FrameP>
  );
}

// PRODUCTION MARK — V11/V12/V13/V15 · all-black circles.
// Order: TL=V11, TR=V12, BL=V13, BR=V15. Tight upper-grade purple cluster.
function ConceptFourPhonesPurplesBlack() {
  const bgs = ['#9C27B0', '#7B1FA2', '#6A1B9A', '#4A148C'];
  return (
    <FrameP
      label="E — V11/V12/V13/V15 · production mark"
      caption="Canonical mark. Four upper-grade purples — tight hue cluster, clear value steps."
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        <FourPhonesIcon size={340} phoneBgs={bgs} circleColor="#0a0a0c" />
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...heavy8, fontSize: 56, color: T8.ink, lineHeight: 0.9 }}>boardsesh</div>
          <div style={{ ...mono8, fontSize: 11, color: T8.inkDim, marginTop: 10, letterSpacing: '0.18em' }}>
            EVERY CLIMB · YOUR CREW
          </div>
        </div>
      </div>
    </FrameP>
  );
}

// White-circle variant of the production mark.
function ConceptFourPhonesPurplesWhite() {
  const bgs = ['#9C27B0', '#7B1FA2', '#6A1B9A', '#4A148C'];
  return (
    <FrameP label="F — V11/V12/V13/V15 · all-white circles" caption="White circles — clean graphic read.">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        <FourPhonesIcon size={340} phoneBgs={bgs} circleColor="#ffffff" />
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...heavy8, fontSize: 56, color: T8.ink, lineHeight: 0.9 }}>boardsesh</div>
          <div style={{ ...mono8, fontSize: 11, color: T8.inkDim, marginTop: 10, letterSpacing: '0.18em' }}>
            EVERY CLIMB · YOUR CREW
          </div>
        </div>
      </div>
    </FrameP>
  );
}

// V11–V15 upper-grade range — four purples (V11/V12/V13/V15).
// V14 is reserved for brand CTA hover.
function ConceptFourPhonesV10V15Black() {
  // top-left V11, top-right V12, bottom-left V13, bottom-right V15
  const bgs = ['#9C27B0', '#7B1FA2', '#6A1B9A', '#4A148C'];
  return (
    <FrameP
      label="E2 — V11/V12/V13/V15 · all-black circles"
      caption="Upper-grade variant. Four purples in tight steps — reads as a single value family."
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        <FourPhonesIcon size={340} phoneBgs={bgs} circleColor="#0a0a0c" />
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...heavy8, fontSize: 56, color: T8.ink, lineHeight: 0.9 }}>boardsesh</div>
          <div style={{ ...mono8, fontSize: 11, color: T8.inkDim, marginTop: 10, letterSpacing: '0.18em' }}>
            EVERY CLIMB · YOUR CREW
          </div>
        </div>
      </div>
    </FrameP>
  );
}

// Favicon-scale comparison: V11–V17 vs V10–V15 at 16/32/48/64px so the
// difference is obvious at the sizes that actually matter.
function ConceptFaviconCompare() {
  const v11_17 = ['#9C27B0', '#6A1B9A', '#4A148C', '#3F51B5'];
  const v10_15 = ['#9C27B0', '#7B1FA2', '#6A1B9A', '#4A148C'];
  const sizes = [16, 32, 48, 64, 96];
  const Row = ({ bgs, label, hexes }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ ...mono8, fontSize: 11, color: T8.inkDim, letterSpacing: '0.18em' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 22 }}>
        {sizes.map((s) => (
          <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <FourPhonesIcon size={s} phoneBgs={bgs} circleColor="#0a0a0c" />
            <div style={{ ...mono8, fontSize: 10, color: T8.inkDim }}>{s}</div>
          </div>
        ))}
      </div>
      <div style={{ ...mono8, fontSize: 10, color: '#6c6960', letterSpacing: '0.1em' }}>{hexes}</div>
    </div>
  );
  return (
    <FrameP
      label="Favicon scale · V11–V17 vs V11–V15"
      caption="Side-by-side at the sizes browsers actually render. The tight V11–V15 cluster keeps four readable quadrants down to 16px."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36, padding: '20px 0' }}>
        <Row bgs={v11_17} label="OLD · V11 V13 V15 V17" hexes="TL #9C27B0 · TR #6A1B9A · BL #4A148C · BR #2A0054" />
        <Row bgs={v10_15} label="NEW · V11 V12 V13 V15" hexes="TL #9C27B0 · TR #7B1FA2 · BL #6A1B9A · BR #4A148C" />
      </div>
    </FrameP>
  );
}

// ============================================================
// Production V-grade stack (V10/V11/V13/V15) + actual board-brand
// colour maps for variants below.
// Order: [top-left, top-right, bottom-left, bottom-right]
// ============================================================
const PURPLES = ['#9C27B0', '#7B1FA2', '#6A1B9A', '#4A148C'];

// Kilter LED palette: green / cyan / magenta / orange
const KILTER_PALETTE = {
  start: '#00FF00',
  hand: '#00FFFF',
  finish: '#FF00FF',
  foot: '#FFAA00',
};
// Tension display palette (Aurora-compatible): green / blue / red / magenta
const TENSION_PALETTE = {
  start: '#00DD00',
  hand: '#4444FF',
  finish: '#FF0000',
  foot: '#FF00FF',
};
// MoonBoard display palette: green / blue / red / cyan
const MOONBOARD_PALETTE = {
  start: '#44FF44',
  hand: '#4444FF',
  finish: '#FF3333',
  foot: '#66F0FF',
};

function ConceptFourPhonesKilter() {
  return (
    <FrameP
      label="G — V11–V17 · Kilter palette"
      caption="Route circles in Kilter LED colours: green / cyan / magenta / orange."
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        <FourPhonesIcon size={340} phoneBgs={PURPLES} palette={KILTER_PALETTE} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...heavy8, fontSize: 56, color: T8.ink, lineHeight: 0.9 }}>boardsesh</div>
          <div style={{ ...mono8, fontSize: 11, color: T8.inkDim, marginTop: 10, letterSpacing: '0.18em' }}>
            KILTER · LED
          </div>
        </div>
      </div>
    </FrameP>
  );
}

function ConceptFourPhonesTension() {
  return (
    <FrameP
      label="H — V11–V17 · Tension palette"
      caption="Route circles in Tension/Aurora display colours: green / blue / red / magenta."
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        <FourPhonesIcon size={340} phoneBgs={PURPLES} palette={TENSION_PALETTE} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...heavy8, fontSize: 56, color: T8.ink, lineHeight: 0.9 }}>boardsesh</div>
          <div style={{ ...mono8, fontSize: 11, color: T8.inkDim, marginTop: 10, letterSpacing: '0.18em' }}>
            TENSION · AURORA
          </div>
        </div>
      </div>
    </FrameP>
  );
}

function ConceptFourPhonesMoonboard() {
  return (
    <FrameP
      label="I — V11–V17 · MoonBoard palette"
      caption="Route circles in MoonBoard display colours: green / blue / red / cyan."
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        <FourPhonesIcon size={340} phoneBgs={PURPLES} palette={MOONBOARD_PALETTE} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...heavy8, fontSize: 56, color: T8.ink, lineHeight: 0.9 }}>boardsesh</div>
          <div style={{ ...mono8, fontSize: 11, color: T8.inkDim, marginTop: 10, letterSpacing: '0.18em' }}>
            MOONBOARD
          </div>
        </div>
      </div>
    </FrameP>
  );
}

// Same palette idea but route circles get a 60% translucent palette FILL with a
// solid black border. Reads as soft coloured discs instead of stroked rings.
function ConceptFourPhonesKilterFilled() {
  return (
    <FrameP label="J — Kilter · 60% fill, black border" caption="Kilter palette at 60% fill, black borders.">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        <FourPhonesIcon size={340} phoneBgs={PURPLES} palette={KILTER_PALETTE} fillFromPalette />
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...heavy8, fontSize: 56, color: T8.ink, lineHeight: 0.9 }}>boardsesh</div>
          <div style={{ ...mono8, fontSize: 11, color: T8.inkDim, marginTop: 10, letterSpacing: '0.18em' }}>
            KILTER · LED
          </div>
        </div>
      </div>
    </FrameP>
  );
}

function ConceptFourPhonesTensionFilled() {
  return (
    <FrameP label="K — Tension · 60% fill, black border" caption="Tension palette at 60% fill, black borders.">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        <FourPhonesIcon size={340} phoneBgs={PURPLES} palette={TENSION_PALETTE} fillFromPalette />
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...heavy8, fontSize: 56, color: T8.ink, lineHeight: 0.9 }}>boardsesh</div>
          <div style={{ ...mono8, fontSize: 11, color: T8.inkDim, marginTop: 10, letterSpacing: '0.18em' }}>
            TENSION · AURORA
          </div>
        </div>
      </div>
    </FrameP>
  );
}

function ConceptFourPhonesMoonboardFilled() {
  return (
    <FrameP label="L — MoonBoard · 60% fill, black border" caption="MoonBoard palette at 60% fill, black borders.">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        <FourPhonesIcon size={340} phoneBgs={PURPLES} palette={MOONBOARD_PALETTE} fillFromPalette />
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...heavy8, fontSize: 56, color: T8.ink, lineHeight: 0.9 }}>boardsesh</div>
          <div style={{ ...mono8, fontSize: 11, color: T8.inkDim, marginTop: 10, letterSpacing: '0.18em' }}>
            MOONBOARD
          </div>
        </div>
      </div>
    </FrameP>
  );
}

// V11–V17 + opacity-shift fill — circles are the screen colour overlaid with
// white at moderate alpha, creating a soft "lifted" disc that's the same hue
// but a brighter tone of the screen.
function ConceptFourPhonesPurplesOpacityShift() {
  return (
    <FrameP
      label="Q — V11–V17 · opacity-shift fill"
      caption="Route circles are a brightened tone of the screen — same hue, lifted opacity."
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        <FourPhonesIcon size={340} phoneBgs={PURPLES} opacityShift opacityShiftAlpha={0.5} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...heavy8, fontSize: 56, color: T8.ink, lineHeight: 0.9 }}>boardsesh</div>
          <div style={{ ...mono8, fontSize: 11, color: T8.inkDim, marginTop: 10, letterSpacing: '0.18em' }}>
            EVERY CLIMB · YOUR CREW
          </div>
        </div>
      </div>
    </FrameP>
  );
}

// ============================================================
// BUMPER STICKER
// "There are no bad conditions. Just bad beta"
// ============================================================
// Same gradient as the OG / social image in the assets tab
const STICKER_BG = 'linear-gradient(135deg, #16121e 0%, #0a0a0c 100%)';
const STICKER_FRAME_BG = '#0a0a0c';

function ConceptBumperSticker() {
  // Brighter purple — needs to pop on the dark gradient
  const accentPurple = '#B968D6';
  const stickerRef = React.useRef(null);
  const [downloading, setDownloading] = React.useState(false);

  const downloadStickerPng = async () => {
    if (!stickerRef.current || !window.htmlToImage) return;
    setDownloading(true);
    try {
      // Render at 4× scale → 3280×1080, plenty for printing a ~10" sticker at 300dpi.
      const dataUrl = await window.htmlToImage.toPng(stickerRef.current, {
        pixelRatio: 4,
        backgroundColor: null,
        cacheBust: true,
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'boardsesh-sticker.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error('Sticker download failed', e);
      alert('Download failed — see console.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <FrameP
      label="R — Bumper sticker"
      caption='"There are no bad conditions. Just bad beta" — sticker mock.'
      bg={STICKER_FRAME_BG}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <div
          ref={stickerRef}
          style={{
            width: 820,
            height: 270,
            background: STICKER_BG,
            borderRadius: 14,
            boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
            border: '1px solid #2a2330',
            display: 'flex',
            alignItems: 'center',
            padding: '0 36px',
            gap: 28,
            boxSizing: 'border-box',
          }}
        >
          <BlackTile size={160} radius={36} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div
              style={{
                ...heavy8,
                fontSize: 30,
                color: '#f4f1ea',
                lineHeight: 1.05,
                letterSpacing: '-0.025em',
                whiteSpace: 'nowrap',
              }}
            >
              There are no bad conditions.
            </div>
            <div
              style={{
                ...heavy8,
                fontSize: 38,
                color: accentPurple,
                lineHeight: 1.05,
                marginTop: 6,
                letterSpacing: '-0.03em',
              }}
            >
              Just bad beta.
            </div>
            <div style={{ ...heavy8, fontSize: 22, color: '#8a8780', marginTop: 18, letterSpacing: '-0.01em' }}>
              www.boardsesh.com
            </div>
          </div>
        </div>
        <button
          onClick={downloadStickerPng}
          disabled={downloading}
          style={{
            background: 'transparent',
            color: T8.ink,
            border: `1px solid ${T8.inkDim}`,
            padding: '10px 18px',
            borderRadius: 6,
            cursor: downloading ? 'wait' : 'pointer',
            ...mono8,
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            opacity: downloading ? 0.6 : 1,
          }}
        >
          {downloading ? 'Rendering…' : '↓ Download print PNG (3280×1080)'}
        </button>
      </div>
    </FrameP>
  );
}

// Wide / banner version — bigger icon, more horizontal
function ConceptBumperStickerDark() {
  const accentPurple = '#B968D6';
  return (
    <FrameP
      label="S — Bumper sticker (wide)"
      caption="Wider banner format — same content, bigger icon."
      bg={STICKER_FRAME_BG}
    >
      <div
        style={{
          width: 900,
          height: 240,
          background: STICKER_BG,
          borderRadius: 14,
          boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
          border: '1px solid #2a2330',
          display: 'flex',
          alignItems: 'center',
          padding: '0 40px',
          gap: 36,
        }}
      >
        <BlackTile size={170} radius={38} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div
            style={{
              ...heavy8,
              fontSize: 32,
              color: '#f4f1ea',
              lineHeight: 1.05,
              letterSpacing: '-0.025em',
              whiteSpace: 'nowrap',
            }}
          >
            There are no bad conditions.
          </div>
          <div
            style={{
              ...heavy8,
              fontSize: 40,
              color: accentPurple,
              lineHeight: 1.05,
              marginTop: 6,
              letterSpacing: '-0.03em',
            }}
          >
            Just bad beta.
          </div>
          <div style={{ ...heavy8, fontSize: 22, color: '#f4f1ea', marginTop: 14, letterSpacing: '-0.01em' }}>
            www.boardsesh.com
          </div>
        </div>
      </div>
    </FrameP>
  );
}

// Square sticker — laptop / water bottle
function ConceptBumperStickerTall() {
  const accentPurple = '#B968D6';
  return (
    <FrameP label="T — Sticker (square)" caption="Square version — fits laptop / water bottle." bg={STICKER_FRAME_BG}>
      <div
        style={{
          width: 380,
          height: 380,
          background: STICKER_BG,
          borderRadius: 18,
          boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
          border: '1px solid #2a2330',
          padding: 32,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <BlackTile size={120} radius={28} />
        <div>
          <div style={{ ...heavy8, fontSize: 28, color: '#f4f1ea', lineHeight: 1.0, letterSpacing: '-0.03em' }}>
            There are no bad conditions.
          </div>
          <div
            style={{
              ...heavy8,
              fontSize: 34,
              color: accentPurple,
              lineHeight: 1.0,
              marginTop: 8,
              letterSpacing: '-0.035em',
            }}
          >
            Just bad beta.
          </div>
          <div style={{ ...heavy8, fontSize: 22, color: '#8a8780', marginTop: 18, letterSpacing: '-0.01em' }}>
            www.boardsesh.com
          </div>
        </div>
      </div>
    </FrameP>
  );
}

// ============================================================
// APP ICON RENDERS — V11–V17 · black circles variant
// ============================================================

// Reusable: the V11-V17 black-circle tile
function BlackTile({ size, radius }) {
  return <FourPhonesIcon size={size} radius={radius ?? size * 0.225} phoneBgs={PURPLES} circleColor="#0a0a0c" />;
}

// iOS home-screen mockup with the icon among other apps
function ConceptIconIOS() {
  // 6×3 grid of placeholder icons + our icon front-and-center.
  const slots = [
    { color: '#1a1a1d', label: '' }, // 0
    { color: '#0d6efd', label: 'Msg' }, // 1
    { color: '#34c759', label: 'Pho' }, // 2
    { color: '#ff9500', label: 'Notes' }, // 3
    { color: '#5856d6', label: 'Calc' }, // 4
    { color: '#ff3b30', label: 'Cam' }, // 5
    { color: '#000', label: 'Wea' }, // 6
    { color: 'boardsesh', label: '' }, // 7  <-- ours
    { color: '#1a1a1d', label: 'Maps' }, // 8
    { color: '#fa3e3e', label: 'Hike' }, // 9
    { color: '#ffd60a', label: 'Notes' }, //10
    { color: '#a2845e', label: 'Wallet' }, //11
    { color: '#34c759', label: 'Heal' }, //12
    { color: '#000', label: 'App' }, //13
    { color: '#0d6efd', label: 'Files' }, //14
    { color: '#ff2d55', label: 'Music' }, //15
    { color: '#5ac8fa', label: 'Find' }, //16
    { color: '#34c759', label: 'Pod' }, //17
    { color: '#ff9500', label: 'Rem' }, //18
    { color: '#5856d6', label: 'TV' }, //19
    { color: '#ff3b30', label: 'Saf' }, //20
  ];
  const COLS = 4;
  const ICON_SIZE = 78;
  const GAP_X = 18;
  const GAP_Y = 28;
  return (
    <FrameP label="M — iOS home screen" caption="V11–V17 black variant as an iOS app icon, sat among other apps.">
      <div
        style={{
          width: 360,
          height: 720,
          borderRadius: 38,
          background: 'linear-gradient(180deg, #4a3a6e 0%, #2a1a4e 100%)',
          padding: '60px 24px 24px',
          boxSizing: 'border-box',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Status bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            color: '#fff',
            ...mono8,
            fontSize: 11,
            marginBottom: 24,
            padding: '0 8px',
          }}
        >
          <span>9:41</span>
          <span>•••</span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${COLS}, ${ICON_SIZE}px)`,
            columnGap: GAP_X,
            rowGap: GAP_Y,
            justifyContent: 'center',
          }}
        >
          {slots.slice(0, 20).map((s, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              {s.color === 'boardsesh' ? (
                <BlackTile size={ICON_SIZE} radius={ICON_SIZE * 0.225} />
              ) : (
                <div
                  style={{
                    width: ICON_SIZE,
                    height: ICON_SIZE,
                    borderRadius: ICON_SIZE * 0.225,
                    background: s.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    ...mono8,
                    fontSize: 10,
                  }}
                >
                  {s.label}
                </div>
              )}
              <div style={{ color: '#fff', fontSize: 10, ...display8, fontWeight: 500 }}>
                {s.color === 'boardsesh' ? 'boardsesh' : s.label}
              </div>
            </div>
          ))}
        </div>
        {/* Dock */}
        <div
          style={{
            position: 'absolute',
            bottom: 22,
            left: 22,
            right: 22,
            height: 96,
            borderRadius: 28,
            background: 'rgba(255,255,255,0.18)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            padding: '0 16px',
          }}
        >
          {['#0d6efd', '#34c759', '#ff3b30', '#ff9500'].map((c, i) => (
            <div key={i} style={{ width: 60, height: 60, borderRadius: 14, background: c }} />
          ))}
        </div>
      </div>
    </FrameP>
  );
}

// macOS dock with the icon
function ConceptIconMacDock() {
  const dockColors = [
    '#0d6efd',
    '#34c759',
    '#ff3b30',
    '#ff9500',
    'boardsesh',
    '#5856d6',
    '#ff2d55',
    '#5ac8fa',
    '#a2845e',
  ];
  const ICON = 64;
  return (
    <FrameP label="N — macOS dock" caption="In the dock, the four-phone tile reads even at 64px.">
      <div
        style={{
          width: 720,
          padding: '80px 40px',
          background: 'linear-gradient(180deg, #2a3a5e 0%, #4a3a6e 100%)',
          borderRadius: 16,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            background: 'rgba(255,255,255,0.22)',
            backdropFilter: 'blur(40px)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 22,
            padding: '10px 14px',
            display: 'flex',
            gap: 10,
            alignItems: 'flex-end',
          }}
        >
          {dockColors.map((c, i) => (
            <div key={i}>
              {c === 'boardsesh' ? (
                <BlackTile size={ICON} radius={ICON * 0.225} />
              ) : (
                <div style={{ width: ICON, height: ICON, borderRadius: ICON * 0.225, background: c }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </FrameP>
  );
}

// Browser tab + favicon
function ConceptIconBrowser() {
  return (
    <FrameP label="O — Browser tab & favicon" caption="Reads cleanly at 16px in tab + 32px in bookmark bar.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'stretch', width: 720 }}>
        {/* Browser chrome */}
        <div
          style={{
            background: '#202124',
            borderRadius: '10px 10px 0 0',
            padding: '10px 12px 0',
            boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
          }}
        >
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4 }}>
            <div
              style={{
                background: '#3a3b3e',
                padding: '8px 12px 8px 10px',
                borderRadius: '8px 8px 0 0',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: '#e8eaed',
                fontSize: 12,
                ...display8,
                maxWidth: 220,
              }}
            >
              <BlackTile size={16} radius={3.5} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                boardsesh — your sesh
              </span>
              <span style={{ color: '#9aa0a6', marginLeft: 6 }}>×</span>
            </div>
            <div
              style={{
                background: 'transparent',
                padding: '8px 12px 8px 10px',
                borderRadius: '8px 8px 0 0',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: '#9aa0a6',
                fontSize: 12,
                ...display8,
              }}
            >
              <div style={{ width: 16, height: 16, borderRadius: 3.5, background: '#0d6efd' }} />
              <span>GitHub</span>
            </div>
            <div
              style={{
                background: 'transparent',
                padding: '8px 12px 8px 10px',
                borderRadius: '8px 8px 0 0',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: '#9aa0a6',
                fontSize: 12,
                ...display8,
              }}
            >
              <div style={{ width: 16, height: 16, borderRadius: 3.5, background: '#ff9500' }} />
              <span>Docs</span>
            </div>
          </div>
          {/* Address bar */}
          <div
            style={{
              background: '#3a3b3e',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: '#e8eaed',
              fontSize: 12,
              ...mono8,
            }}
          >
            <span style={{ color: '#9aa0a6' }}>← → ↻</span>
            <div
              style={{
                flex: 1,
                background: '#202124',
                borderRadius: 16,
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <BlackTile size={14} radius={3} />
              <span>www.boardsesh.com</span>
            </div>
          </div>
          <div style={{ background: '#202124', height: 16 }} />
        </div>
        {/* Favicon scale ladder */}
        <div
          style={{
            display: 'flex',
            gap: 32,
            alignItems: 'flex-end',
            padding: '16px 24px',
            background: T8.bgTile,
            borderRadius: 12,
          }}
        >
          {[16, 24, 32, 48, 64].map((s) => (
            <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <BlackTile size={s} radius={s * 0.225} />
              <div style={{ ...mono8, fontSize: 9, color: T8.inkDim }}>{s}px</div>
            </div>
          ))}
        </div>
      </div>
    </FrameP>
  );
}

// Marketing lockup — big icon + wordmark, hero-style
function ConceptIconHero() {
  return (
    <FrameP label="P — Hero lockup" caption="App-store / hero treatment for the V11–V17 black variant." bg="#16121e">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 36 }}>
        <BlackTile size={260} radius={56} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...heavy8, fontSize: 80, color: T8.ink, lineHeight: 0.9 }}>boardsesh</div>
          <div style={{ ...mono8, fontSize: 12, color: T8.inkDim, marginTop: 14, letterSpacing: '0.22em' }}>
            EVERY CLIMB · YOUR CREW
          </div>
        </div>
      </div>
    </FrameP>
  );
}

// Single phone large, for spec
function ConceptSinglePhone() {
  return (
    <FrameP label="D — Single phone (detail)" caption="One phone. The climb fills the screen.">
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <div style={{ background: T8.bgTile, padding: 24, borderRadius: 18 }}>
          <MiniPhone routeIdx={0} screenBg="hsl(14, 25%, 22%)" scale={1.4} />
        </div>
        <div>
          <div style={{ ...heavy8, fontSize: 56, color: T8.ink, lineHeight: 0.9 }}>boardsesh</div>
          <div style={{ ...mono8, fontSize: 11, color: T8.inkDim, marginTop: 10, letterSpacing: '0.18em' }}>
            EVERY CLIMB · EVERY DEVICE
          </div>
        </div>
      </div>
    </FrameP>
  );
}

// Scale ladder
function ConceptPhonesScale() {
  return (
    <FrameP label="E — Scale ladder" caption="Phone tile at app/favicon sizes.">
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end' }}>
        {[200, 128, 80, 48].map((s) => (
          <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <FourPhonesIcon size={s} gap={Math.max(2, s * 0.018)} radius={s * 0.07} />
            <div style={{ ...mono8, fontSize: 9, color: T8.inkDim }}>{s}px</div>
          </div>
        ))}
      </div>
    </FrameP>
  );
}

// Horizontal lockup
function ConceptPhonesLockup() {
  return (
    <FrameP label="F — Horizontal lockup" caption="Four-phones tile + wordmark.">
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <FourPhonesIcon size={150} gap={3} radius={12} />
        <div>
          <div style={{ ...display8, fontSize: 64, color: T8.ink, lineHeight: 1 }}>boardsesh</div>
          <div style={{ ...mono8, fontSize: 11, color: T8.inkDim, marginTop: 8, letterSpacing: '0.18em' }}>
            ONE BOARD · YOUR CREW
          </div>
        </div>
      </div>
    </FrameP>
  );
}

Object.assign(window, {
  ConceptFourPhones,
  ConceptFourPhonesHuddle,
  ConceptFourPhonesSolid,
  ConceptFourPhonesPurples,
  ConceptFourPhonesPurplesBlack,
  ConceptFourPhonesPurplesWhite,
  ConceptFourPhonesV10V15Black,
  ConceptFaviconCompare,
  ConceptFourPhonesKilter,
  ConceptFourPhonesTension,
  ConceptFourPhonesMoonboard,
  ConceptFourPhonesKilterFilled,
  ConceptFourPhonesTensionFilled,
  ConceptFourPhonesMoonboardFilled,
  ConceptFourPhonesPurplesOpacityShift,
  ConceptBumperSticker,
  ConceptBumperStickerDark,
  ConceptBumperStickerTall,
  ConceptIconIOS,
  ConceptIconMacDock,
  ConceptIconBrowser,
  ConceptIconHero,
  ConceptSinglePhone,
  ConceptPhonesScale,
  ConceptPhonesLockup,
});
