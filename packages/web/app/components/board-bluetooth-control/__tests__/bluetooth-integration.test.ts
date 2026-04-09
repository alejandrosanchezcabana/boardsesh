import { describe, it, expect, vi } from 'vitest';

/**
 * Integration tests: full pipeline from climb frames → LED lookup → BLE packet.
 *
 * Uses real climbs from the Kilter and Tension apps with real LED placement data.
 * Each test asserts on the **exact expected hex payload** — any change to
 * encoding, framing, color mapping, or LED position data will break these.
 *
 * Climbs are only tested on board sizes where ALL holds resolve. The protocol
 * throws when any holds are missing (indicating a search filter bug).
 */

vi.mock('@/app/lib/moonboard-config', () => ({
  MOONBOARD_ENABLED: false,
}));

import { getAuroraBluetoothPacket as getBluetoothPacket } from '../bluetooth-aurora';
import { splitMessages } from '../bluetooth-shared';
import { getLedPlacements } from '@boardsesh/board-constants/led-placements';
import type { BoardName } from '@/app/lib/types';

// ---- Helpers ----

function toHex(data: Uint8Array): string {
  return Array.from(data).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function verifyFrameIntegrity(packet: Uint8Array): void {
  const bytes = Array.from(packet);
  let i = 0;
  while (i < bytes.length) {
    expect(bytes[i]).toBe(0x01);
    const payloadLen = bytes[i + 1];
    expect(payloadLen).toBeGreaterThan(0);
    expect(payloadLen).toBeLessThanOrEqual(255);
    expect(bytes[i + 3]).toBe(0x02);
    const payload = bytes.slice(i + 4, i + 4 + payloadLen);
    const sum = payload.reduce((acc: number, v: number) => (acc + v) & 0xff, 0);
    expect(bytes[i + 2]).toBe(sum ^ 0xff);
    expect(bytes[i + 4 + payloadLen]).toBe(0x03);
    i += payloadLen + 5;
  }
  expect(i).toBe(bytes.length);
}

interface SizeExpectation {
  name: string;
  sizeId: number;
  v3: string;
  v2: string;
}

interface ClimbTest {
  climbName: string;
  board: BoardName;
  frames: string;
  layoutId: number;
  sizes: SizeExpectation[];
}

/** Generate tests for a climb across all its fully-compatible sizes. */
function testClimb(climb: ClimbTest) {
  describe(`"${climb.climbName}" (${climb.board} layout ${climb.layoutId})`, () => {
    for (const size of climb.sizes) {
      describe(`${size.name} (size ${size.sizeId})`, () => {
        const ledMap = getLedPlacements(climb.board, climb.layoutId, size.sizeId);

        // Only Aurora boards (Kilter/Tension) use this packet generation
        if (climb.board !== 'moonboard') {
          const boardName = climb.board;

          it('v3 packet matches expected payload', () => {
            expect(toHex(getBluetoothPacket(climb.frames, ledMap, boardName, 3))).toBe(size.v3);
          });

          it('v2 packet matches expected payload', () => {
            expect(toHex(getBluetoothPacket(climb.frames, ledMap, boardName, 2))).toBe(size.v2);
          });

          it('frame integrity', () => {
            verifyFrameIntegrity(getBluetoothPacket(climb.frames, ledMap, boardName, 3));
            verifyFrameIntegrity(getBluetoothPacket(climb.frames, ledMap, boardName, 2));
          });

          it('BLE chunks fit 20-byte MTU', () => {
            for (const v of [2, 3] as const) {
              for (const chunk of splitMessages(getBluetoothPacket(climb.frames, ledMap, boardName, v))) {
                expect(chunk.length).toBeLessThanOrEqual(20);
              }
            }
          });
        }
      });
    }
  });
}

// =============================================================================
// Kilter Homewall (layout 8) — all holds resolve on all sizes
// =============================================================================

testClimb({
  climbName: 'Go Go Right',
  board: 'kilter',
  frames: 'p4265r45p4269r45p4331r43p4334r44p4350r45p4356r42p4363r44p4412r45p4415r42',
  layoutId: 8,
  sizes: [
    { name: '7x10 Full Ride', sizeId: 17,
      v3: '011cc202549400f49800f4d6001fd900e3e900f4ef001cf600e32701f42a011c03',
      v2: '0113ff025094e098e0d63cd9cce9e0ef30f6cc27e12a3103' },
    { name: '7x10 Mainline', sizeId: 18,
      v3: '011c8a02545600f45200f46c001f6900e37900f47f001c8600e39b00f49e001c03',
      v2: '0113c7025056e052e06c3c69cc79e07f3086cc9be09e3003' },
    { name: '10x10 Full Ride', sizeId: 21,
      v3: '011c4a0254c700f4c300f4f9001ff600e32001f41a011c1301e35601f453011c03',
      v2: '0113870250c7e0c3e0f93cf6cc20e11a3113cd56e1533103' },
    { name: '10x10 Mainline', sizeId: 22,
      v3: '011cf502545d00f46100f483001f8600e39400f48e001c8700e3ae00f4ab001c03',
      v2: '01133202505de061e0833c86cc94e08e3087ccaee0ab3003' },
    { name: '8x12 Full Ride', sizeId: 23,
      v3: '011c440254cb00f4cf00f419011f1c01e33201f438011c3f01e37c01f47f011c03',
      v2: '0113810250cbe0cfe0193d1ccd32e138313fcd7ce17f3103' },
    { name: '8x12 Mainline', sizeId: 24,
      v3: '011ce902547b00f47700f497001f9400e3aa00f4b0001cb700e3d200f4d5001c03',
      v2: '01132602507be077e0973c94ccaae0b030b7ccd2e0d53003' },
    { name: '10x12 Full Ride', sizeId: 25,
      v3: '011c6102540a01f40601f448011f4501e37501f46f011c6801e3b701f4b4011c03',
      v2: '01139e02500ae106e1483d45cd75e16f3168cdb7e1b43103' },
    { name: '10x12 Mainline', sizeId: 26,
      v3: '011c0602548e00f49200f4ba001fbd00e3cb00f4c5001cbe00e3eb00f4e8001c03',
      v2: '01134302508ee092e0ba3cbdcccbe0c530beccebe0e83003' },
  ],
});

testClimb({
  climbName: 'Mid Range Game',
  board: 'kilter',
  frames: 'p4119r45p4131r44p4184r43p4199r45p4208r43p4220r43p4231r42p4265r42p4270r43p4530r45p4663r45',
  layoutId: 8,
  // Only 10x12 Full Ride (size 25) resolves all 11 holds.
  // 10x12 Mainline (size 26) skips 3 Auxiliary-only holds → tested in "throws" section.
  sizes: [
    { name: '10x12 Full Ride', sizeId: 25,
      v3: '0122f502545c00f45000e39b001faf00f4c3001fda001fcf001c0a011c05011fc900f41300f403',
      v2: '0117c402505ce050cc9b3cafe0c33cda3ccf300a31053dc9e013e003' },
  ],
});

// =============================================================================
// Kilter Original (layout 1) — only sizes where ALL holds resolve
// =============================================================================

testClimb({
  climbName: 'Hailey Mary.',
  board: 'kilter',
  frames: 'p1143r12p1158r12p1181r13p1204r15p1229r13p1252r13p1284r13p1320r13p1322r13p1389r14p1464r15p1467r15',
  layoutId: 1,
  // 12 holds. Sizes 8 (9/12), 14 (8/12), 27 (11/12) skip holds → tested in "throws" section.
  sizes: [
    { name: '12x14', sizeId: 7,
      v3: '01256f025469001c2c001cde001f8b01f491001f3a011ffe001f34011f6d011f6101e32100f49c00f403',
      v2: '0119f0025069302c30de3c8be1913c3a3dfe3c343d6d3d61cd21e09ce003' },
    { name: '12x12 w/kick', sizeId: 10,
      v3: '012559025463001c2c001ccc001f6701f485001f1c011fe6001f16011f49011f4301e32100f49000f403',
      v2: '0119da025063302c30cc3c67e1853c1c3de63c163d493d43cd21e090e003' },
    { name: '16x12', sizeId: 28,
      v3: '01255c0254cb001c96001c2e011fc501f4dc001f77011f47011f7d011fb0011f8301e32800f4d100f403',
      v2: '0119dd0250cb3096302e3dc5e1dc3c773d473d7d3db03d83cd28e0d1e003' },
  ],
});

testClimb({
  climbName: 'Kings Cross',
  board: 'kilter',
  frames: 'p1080r15p1131r12p1134r12p1219r13p1251r13p1281r13p1301r13p1316r13p1365r13p1383r14p1452r15p1505r15p1530r15',
  layoutId: 1,
  // 13 holds. Sizes 14 (9/13), 27 (11/13) skip holds → tested in "throws" section.
  sizes: [
    { name: '12x14', sizeId: 7,
      v3: '0128c702540f00f40c011c4c011c53011f1d011fae001ffd001fc2001f85001fb600e30a00f40801f4a900f403',
      v2: '011b5c02500fe00c314c31533d1d3dae3cfd3cc23c853cb6cc0ae008e1a9e003' },
    { name: '8x12', sizeId: 8,
      v3: '01288002540900f488001ce7001ce0001faa001f41001f97001f66001f37001f3900e30400f48c00f44600f403',
      v2: '011b15025009e08830e730e03caa3c413c973c663c373c39cc04e08ce046e003' },
    { name: '12x12 w/kick', sizeId: 10,
      v3: '0128a702540f00f4f4001c2e011c35011f05011fa2001fe5001fb0001f79001faa00e30a00f4f000f49d00f403',
      v2: '011b3c02500fe0f4302e31353d053da23ce53cb03c793caacc0ae0f0e09de003' },
    { name: '16x12', sizeId: 28,
      v3: '0128c602541500f439011c98011c91011f5b011ff2001f48011f17011fe8001fea00e31000f43d01f4f700f403',
      v2: '011b5b025015e039319831913d5b3df23c483d173de83ceacc10e03de1f7e003' },
  ],
});

testClimb({
  climbName: 'bless your heart',
  board: 'kilter',
  frames: 'p1151r15p1216r12p1254r12p1302r13p1336r13p1385r14p1532r15p1557r15',
  layoutId: 1,
  // All 8 holds resolve on every Kilter Original size
  sizes: [
    { name: '12x14', sizeId: 7,
      v3: '0119ce02544d01f404011c73011c22011f25011fef00e31b01f48d00f403',
      v2: '0111c302504de104317331223d253defcc1be18de003' },
    { name: '8x12', sizeId: 8,
      v3: '01197b0254e600f490001cf9001ca5001fa2001f6c00e3ac00f42d00f403',
      v2: '0111700250e6e09030f930a53ca23c6cccace02de003' },
    { name: '12x12 w/kick', sizeId: 10,
      v3: '01198f02542f01f4ec001c4f011c0a011f0d011fdd00e30301f48100f403',
      v2: '01118402502fe1ec304f310a3d0d3dddcc03e181e003' },
    { name: '7x10', sizeId: 14,
      v3: '0119290254a700f45a001cb1001c6f001f6c001f3f00e37600f40b00f403',
      v2: '01111e0250a7e05a30b1306f3c6c3c3fcc76e00be003' },
    { name: '12x12 w/o kick', sizeId: 27,
      v3: '0119b202540b01f4c8001c2b011ce6001fe9001fb900e3df00f45d00f403',
      v2: '0111a702500be1c8302b31e63ce93cb9ccdfe05de003' },
    { name: '16x12', sizeId: 28,
      v3: '0119ea02549701f441011caa011c56011f53011f1d01e35d01f4e000f403',
      v2: '0111df025097e14131aa31563d533d1dcd5de1e0e003' },
  ],
});

// =============================================================================
// Tension (layout 10 and 11) — only sizes where ALL holds resolve
// =============================================================================

testClimb({
  climbName: 'Catastrophe',
  board: 'tension',
  frames: 'p452r6p473r6p550r6p563r8p577r8p589r7p689r8p695r6p704r5p722r6p727r8p728r8p733r8p734r8p744r6p750r8',
  layoutId: 10,
  // 16 holds. Sizes 7 (14/16), 9 (14/16) skip 2 holds → tested in "throws" section.
  sizes: [
    { name: 'Tension 12x16', sizeId: 6,
      v3: '01312002544f01038c01031f01030f01e3ea00e3e300e03e01e349010363011c890103a201e39c01e3a401e3a801e3ba0103ca01e303',
      v2: '0121b202504f0d8c0d1f0d0fcdeacce3c03ecd490d6331890da2cd9ccda4cda8cdba0dcacd03' },
    { name: 'Tension 12x18', sizeId: 8,
      v3: '0131b60254e60003230103b60003a600e38100e37a00e0d500e3e00003fa001c2001033901e33301e33b01e33f01e35101036101e303',
      v2: '0121480250e60c230db60ca6cc81cc7ac0d5cce00cfa30200d39cd33cd3bcd3fcd510d61cd03' },
  ],
});

testClimb({
  climbName: 'Loose Footie',
  board: 'tension',
  frames: 'p848r6p850r6p907r5p996r8p1088r8p1097r5p1113r8p1132r6p1148r8p1163r6p1226r6p1254r7',
  layoutId: 11,
  // All 12 holds resolve on every size
  sizes: [
    { name: 'Tension 12x16', sizeId: 6,
      v3: '0125820254720003750003fb001ccd01e36900e386001cac00e3c50003f500e30a01038f0103d501e003',
      v2: '0119ad0250720c750cfb30cdcd69cc8630acccc50cf5cc0a0d8f0dd5c103' },
    { name: 'Tension 8x12', sizeId: 7,
      v3: '0125750254600003630003d1001c7f01e35700e36e001c8e00e3a10003cb00e3da00034d01038701e003',
      v2: '0119a00250600c630cd1307fcd57cc6e308ecca10ccbccda0c4d0d87c103' },
    { name: 'Tension 12x18', sizeId: 8,
      v3: '01256f02540900030c000392001c6401e30000e31d001c4300e35c00038c00e3a100032601036c01e003',
      v2: '01199a0250090c0c0c923064cd00cc1d3043cc5c0c8ccca10c260d6cc103' },
    { name: 'Tension 8x14', sizeId: 9,
      v3: '01258a02540900030c00037a001c2801e30000e317001c3700e34a00037400e3830003f600033001e003',
      v2: '0119b50250090c0c0c7a3028cd00cc173037cc4a0c74cc830cf60c30c103' },
  ],
});

// =============================================================================
// Cross-size: same climb produces different packets per board size
// =============================================================================

describe('Cross-size: same climb produces different packets per board size (§18.4)', () => {
  it('"Go Go Right" has unique v3 payloads for each of the 8 homewall sizes', () => {
    const frames = 'p4265r45p4269r45p4331r43p4334r44p4350r45p4356r42p4363r44p4412r45p4415r42';
    const hexes = new Set<string>();
    for (const sizeId of [17, 18, 21, 22, 23, 24, 25, 26]) {
      const ledMap = getLedPlacements('kilter', 8, sizeId);
      hexes.add(toHex(getBluetoothPacket(frames, ledMap, 'kilter', 3)));
    }
    expect(hexes.size).toBe(8);
  });

  it('"bless your heart" has unique v3 payloads for each of the 6 Original sizes', () => {
    const frames = 'p1151r15p1216r12p1254r12p1302r13p1336r13p1385r14p1532r15p1557r15';
    const hexes = new Set<string>();
    for (const sizeId of [7, 8, 10, 14, 27, 28]) {
      const ledMap = getLedPlacements('kilter', 1, sizeId);
      hexes.add(toHex(getBluetoothPacket(frames, ledMap, 'kilter', 3)));
    }
    expect(hexes.size).toBe(6);
  });
});

// =============================================================================
// Throws when climb has missing holds on the target board
// =============================================================================

describe('Throws when any placements are missing (search filter bug)', () => {
  // --- Zero LEDs resolved (completely wrong board) ---

  it('Kilter Original climb on Homewall board throws (zero overlap)', () => {
    const ledMap = getLedPlacements('kilter', 8, 17);
    const frames = 'p1080r15p1131r12p1134r12';
    expect(() => getBluetoothPacket(frames, ledMap, 'kilter', 3)).toThrow('placements have no LED mapping');
  });

  it('Tension climb on Kilter board throws (zero overlap)', () => {
    const ledMap = getLedPlacements('kilter', 1, 7);
    const frames = 'p452r6p473r6p550r6';
    expect(() => getBluetoothPacket(frames, ledMap, 'tension', 3)).toThrow('placements have no LED mapping');
  });

  it('empty placements map throws', () => {
    expect(() => getBluetoothPacket('p1r42p2r42', {}, 'kilter', 3)).toThrow('placements have no LED mapping');
  });

  // --- Partial match (climb uses holds not on this board size) ---

  it('"Mid Range Game" on 10x12 Mainline throws (3 Auxiliary holds missing)', () => {
    const ledMap = getLedPlacements('kilter', 8, 26);
    const frames = 'p4119r45p4131r44p4184r43p4199r45p4208r43p4220r43p4231r42p4265r42p4270r43p4530r45p4663r45';
    expect(() => getBluetoothPacket(frames, ledMap, 'kilter', 3)).toThrow('3 of 11 placements have no LED mapping');
  });

  it('"Hailey Mary." on 8x12 Original throws (3 holds missing)', () => {
    const ledMap = getLedPlacements('kilter', 1, 8);
    const frames = 'p1143r12p1158r12p1181r13p1204r15p1229r13p1252r13p1284r13p1320r13p1322r13p1389r14p1464r15p1467r15';
    expect(() => getBluetoothPacket(frames, ledMap, 'kilter', 3)).toThrow('3 of 12 placements have no LED mapping');
  });

  it('"Hailey Mary." on 7x10 Original throws (4 holds missing)', () => {
    const ledMap = getLedPlacements('kilter', 1, 14);
    const frames = 'p1143r12p1158r12p1181r13p1204r15p1229r13p1252r13p1284r13p1320r13p1322r13p1389r14p1464r15p1467r15';
    expect(() => getBluetoothPacket(frames, ledMap, 'kilter', 3)).toThrow('4 of 12 placements have no LED mapping');
  });

  it('"Hailey Mary." on 12x12 w/o kick throws (1 hold missing)', () => {
    const ledMap = getLedPlacements('kilter', 1, 27);
    const frames = 'p1143r12p1158r12p1181r13p1204r15p1229r13p1252r13p1284r13p1320r13p1322r13p1389r14p1464r15p1467r15';
    expect(() => getBluetoothPacket(frames, ledMap, 'kilter', 3)).toThrow('1 of 12 placements have no LED mapping');
  });

  it('"Kings Cross" on 7x10 Original throws (4 holds missing)', () => {
    const ledMap = getLedPlacements('kilter', 1, 14);
    const frames = 'p1080r15p1131r12p1134r12p1219r13p1251r13p1281r13p1301r13p1316r13p1365r13p1383r14p1452r15p1505r15p1530r15';
    expect(() => getBluetoothPacket(frames, ledMap, 'kilter', 3)).toThrow('4 of 13 placements have no LED mapping');
  });

  it('"Kings Cross" on 12x12 w/o kick throws (2 holds missing)', () => {
    const ledMap = getLedPlacements('kilter', 1, 27);
    const frames = 'p1080r15p1131r12p1134r12p1219r13p1251r13p1281r13p1301r13p1316r13p1365r13p1383r14p1452r15p1505r15p1530r15';
    expect(() => getBluetoothPacket(frames, ledMap, 'kilter', 3)).toThrow('2 of 13 placements have no LED mapping');
  });

  it('"Catastrophe" on Tension 8x12 throws (2 holds missing)', () => {
    const ledMap = getLedPlacements('tension', 10, 7);
    const frames = 'p452r6p473r6p550r6p563r8p577r8p589r7p689r8p695r6p704r5p722r6p727r8p728r8p733r8p734r8p744r6p750r8';
    expect(() => getBluetoothPacket(frames, ledMap, 'tension', 3)).toThrow('2 of 16 placements have no LED mapping');
  });

  it('"Catastrophe" on Tension 8x14 throws (2 holds missing)', () => {
    const ledMap = getLedPlacements('tension', 10, 9);
    const frames = 'p452r6p473r6p550r6p563r8p577r8p589r7p689r8p695r6p704r5p722r6p727r8p728r8p733r8p734r8p744r6p750r8';
    expect(() => getBluetoothPacket(frames, ledMap, 'tension', 3)).toThrow('2 of 16 placements have no LED mapping');
  });
});
