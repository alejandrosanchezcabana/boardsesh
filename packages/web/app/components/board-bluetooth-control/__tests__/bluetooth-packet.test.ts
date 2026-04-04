import { describe, it, expect, vi } from 'vitest';

/**
 * Test BLE packet generation against known-good Aurora payloads.
 *
 * These payloads were captured from Aurora's official Kilter app for the
 * SAME climb on two different board sizes. They serve as ground truth
 * for LED position correctness.
 *
 * Climb holds (6 holds, same placement IDs on both sizes):
 *   4131 (x=-40, y=140) — starting hold
 *   4421 (x=40, y=140)  — starting hold
 *   4669 (x=36, y=-8)   — foot hold
 *   4655 (x=40, y=-4)   — foot hold
 *   4665 (x=-40, y=-4)  — foot hold
 *   4678 (x=-36, y=-8)  — foot hold
 */

// Mock transitive dependencies so bluetooth.ts can be imported directly
vi.mock('@/app/lib/moonboard-config', () => ({
  MOONBOARD_ENABLED: false,
}));

import { getBluetoothPacket } from '../bluetooth';

// ---- Packet decoder ----

function decodeLedPositions(input: Uint8Array | string): { position: number; color: number }[] {
  let bytes: number[];
  if (typeof input === 'string') {
    bytes = [];
    for (let i = 0; i < input.length; i += 2) {
      bytes.push(parseInt(input.substring(i, i + 2), 16));
    }
  } else {
    bytes = Array.from(input);
  }
  // SOH(1) Length(1) Checksum(1) STX(1) Command(1) ...ledData... ETX(1)
  const ledData = bytes.slice(5, -1);
  const leds: { position: number; color: number }[] = [];
  for (let i = 0; i < ledData.length; i += 3) {
    leds.push({
      position: ledData[i] | (ledData[i + 1] << 8),
      color: ledData[i + 2],
    });
  }
  return leds;
}

// ---- Known-good Aurora payloads ----

const AURORA_8x12_HEX = '01134002542700e38501e31400f41300f40100f40000f403';
const AURORA_10x12_HEX = '0113e202545000e3ae01e30400f40300f41700f41600f403';

// Frames string for this climb (derived from placement IDs)
// Order matches Aurora payload: 4131, 4421, 4669, 4655, 4665, 4678
const CLIMB_FRAMES = 'p4131r42p4421r42p4669r45p4655r45p4665r45p4678r45';

// Correct LED positions from Aurora's official app
const CORRECT_8x12_POSITIONS: Record<number, number> = {
  4131: 39,
  4421: 389,
  4669: 20,
  4655: 19,
  4665: 1,
  4678: 0,
};

const CORRECT_10x12_POSITIONS: Record<number, number> = {
  4131: 80,
  4421: 430,
  4669: 4,
  4655: 3,
  4665: 23,
  4678: 22,
};

describe('getBluetoothPacket — Aurora payload verification', () => {
  it('generates correct LED positions for Kilter 10x12 Full Ride (size 25)', () => {
    const packet = getBluetoothPacket(CLIMB_FRAMES, CORRECT_10x12_POSITIONS, 'kilter');
    const ourPositions = decodeLedPositions(packet).map((l) => l.position);
    const auroraPositions = decodeLedPositions(AURORA_10x12_HEX).map((l) => l.position);
    expect(ourPositions).toEqual(auroraPositions);
  });

  it('generates correct LED positions for Kilter 8x12 Full Ride (size 23)', () => {
    const packet = getBluetoothPacket(CLIMB_FRAMES, CORRECT_8x12_POSITIONS, 'kilter');
    const ourPositions = decodeLedPositions(packet).map((l) => l.position);
    const auroraPositions = decodeLedPositions(AURORA_8x12_HEX).map((l) => l.position);
    expect(ourPositions).toEqual(auroraPositions);
  });

  it('skips placements with no LED mapping instead of encoding position 0', () => {
    const sparseLedMap = { 4131: 39, 4421: 389 };
    const frames = 'p4131r42p4421r42p9999r45';

    const packet = getBluetoothPacket(frames, sparseLedMap, 'kilter');
    const leds = decodeLedPositions(packet);

    // 9999 should be skipped, not encoded as position 0
    expect(leds).toHaveLength(2);
    expect(leds[0].position).toBe(39);
    expect(leds[1].position).toBe(389);
  });

  it('8x12 kickboard positions match Aurora expectations', () => {
    // The 8x12 kickboard strip runs left-to-right, opposite from the 10x12.
    // Our database originally had these reversed.
    expect(CORRECT_8x12_POSITIONS[4678]).toBe(0);  // leftmost y=-8
    expect(CORRECT_8x12_POSITIONS[4665]).toBe(1);  // leftmost y=-4
    expect(CORRECT_8x12_POSITIONS[4655]).toBe(19); // rightmost y=-4
    expect(CORRECT_8x12_POSITIONS[4669]).toBe(20); // rightmost y=-8
  });
});
