// Decode raw BLE writes that the ESP32 emulator forwards back to the dev UI.
// Inverts what packages/web/app/components/board-bluetooth-control/bluetooth-aurora.ts
// (Aurora v2/v3) and bluetooth-moonboard.ts encode, so the same fixtures used to
// validate the encoder also validate this decoder via round-trip tests.
//
// Aurora frames arrive as ≤20-byte BLE chunks because the phone splits with
// `splitMessages` before writing; we accumulate bytes and emit a complete LED
// snapshot when a single-frame (T/P) or multi-frame (R…Q…S / N…M…O) sequence
// completes.

import { buildFramesString, getReverseLedPlacements } from '@boardsesh/board-constants/led-placements';
import type { BoardName } from '@boardsesh/shared-schema';

import { MOONBOARD_GRID } from '@/app/lib/moonboard-config';

// Aurora command bytes (must match bluetooth-aurora.ts).
const V3_PACKET_MIDDLE = 0x51; // 'Q' 81
const V3_PACKET_FIRST = 0x52; // 'R' 82
const V3_PACKET_LAST = 0x53; // 'S' 83
const V3_PACKET_ONLY = 0x54; // 'T' 84

const V2_PACKET_MIDDLE = 0x4d; // 'M' 77
const V2_PACKET_FIRST = 0x4e; // 'N' 78
const V2_PACKET_LAST = 0x4f; // 'O' 79
const V2_PACKET_ONLY = 0x50; // 'P' 80

const FRAME_SOH = 0x01;
const FRAME_STX = 0x02;
const FRAME_ETX = 0x03;

export type DecodedLed = {
  position: number;
  /** RGB triplet recovered from the colour byte (0–255 each). */
  r: number;
  g: number;
  b: number;
};

export type DecodedAuroraFrame = {
  board: BoardName;
  apiLevel: 2 | 3;
  leds: DecodedLed[];
  /** Frames string suitable for `convertLitUpHoldsStringToMap`. Empty if no LED maps. */
  framesString: string;
};

export type DecodedMoonboardFrame = {
  board: 'moonboard';
  leds: Array<{ holdId: number; roleCode: number }>;
  framesString: string;
};

export type DecodedFrame = DecodedAuroraFrame | DecodedMoonboardFrame;

// ---- Aurora colour byte → 8-bit RGB ----

// v3 colour byte: RRRGGGBB. We expand each channel back to a representative
// 8-bit value by replicating the high bits, which lets `colorToRoleCode` (in
// led-placements.ts) classify it via its >127 thresholds.
function expandV3Color(byte: number): { r: number; g: number; b: number } {
  const r3 = (byte >> 5) & 0b111;
  const g3 = (byte >> 2) & 0b111;
  const b2 = byte & 0b11;
  return {
    r: (r3 << 5) | (r3 << 2) | (r3 >> 1),
    g: (g3 << 5) | (g3 << 2) | (g3 >> 1),
    b: (b2 << 6) | (b2 << 4) | (b2 << 2) | b2,
  };
}

// v2 colour byte: (R<<6) | (G<<4) | (B<<2) | posHi[1:0].
function expandV2Color(byte: number): { r: number; g: number; b: number } {
  const r2 = (byte >> 6) & 0b11;
  const g2 = (byte >> 4) & 0b11;
  const b2 = (byte >> 2) & 0b11;
  return {
    r: (r2 << 6) | (r2 << 4) | (r2 << 2) | r2,
    g: (g2 << 6) | (g2 << 4) | (g2 << 2) | g2,
    b: (b2 << 6) | (b2 << 4) | (b2 << 2) | b2,
  };
}

// ---- Aurora frame parsing ----

type ParsedFrame = {
  command: number;
  // payload = command byte + LED data
  payload: Uint8Array;
  /** Total bytes consumed from the input buffer (header + payload + ETX). */
  consumed: number;
};

// Parse a single framed message starting at offset 0 of `bytes`. Returns null
// if the buffer doesn't contain a complete, valid frame yet.
function parseFrame(bytes: Uint8Array): ParsedFrame | null {
  if (bytes.length < 5) return null;
  if (bytes[0] !== FRAME_SOH) return null;
  const length = bytes[1];
  // Frame layout: SOH(1) LEN(1) CHK(1) STX(1) PAYLOAD(length) ETX(1) = length + 5
  if (bytes.length < length + 5) return null;
  if (bytes[3] !== FRAME_STX) return null;
  if (bytes[length + 4] !== FRAME_ETX) return null;
  const payload = bytes.subarray(4, 4 + length);
  return { command: payload[0], payload, consumed: length + 5 };
}

function decodeLedDataV3(ledBytes: Uint8Array): DecodedLed[] {
  const leds: DecodedLed[] = [];
  for (let i = 0; i + 2 < ledBytes.length; i += 3) {
    const position = ledBytes[i] | (ledBytes[i + 1] << 8);
    const colour = expandV3Color(ledBytes[i + 2]);
    leds.push({ position, ...colour });
  }
  return leds;
}

function decodeLedDataV2(ledBytes: Uint8Array): DecodedLed[] {
  const leds: DecodedLed[] = [];
  for (let i = 0; i + 1 < ledBytes.length; i += 2) {
    const posLo = ledBytes[i];
    const byte2 = ledBytes[i + 1];
    const posHi = byte2 & 0b11;
    const position = posLo | (posHi << 8);
    const colour = expandV2Color(byte2);
    leds.push({ position, ...colour });
  }
  return leds;
}

// ---- MoonBoard ASCII payload ----

// Reverse of `getMoonboardSerialPosition`: serial position → 1-based holdId.
function moonboardSerialToHoldId(serialPosition: number): number | null {
  const { numColumns, numRows } = MOONBOARD_GRID;
  const colIndex = Math.floor(serialPosition / numRows);
  if (colIndex < 0 || colIndex >= numColumns) return null;
  const rawRow = serialPosition - colIndex * numRows;
  const rowIndex = colIndex % 2 === 0 ? rawRow : numRows - 1 - rawRow;
  if (rowIndex < 0 || rowIndex >= numRows) return null;
  return rowIndex * numColumns + colIndex + 1;
}

const MOONBOARD_LETTER_TO_ROLE: Record<string, number> = {
  S: 42, // STARTING
  P: 43, // HAND
  E: 44, // FINISH
};

// Parse an already-fully-buffered MoonBoard payload of the form `l#…#`.
function parseCompleteMoonboardAscii(text: string): DecodedMoonboardFrame | null {
  const match = text.match(/^l#([^#]*)#$/);
  if (!match) return null;
  const inner = match[1];
  const leds: DecodedMoonboardFrame['leds'] = [];
  if (inner.length > 0) {
    for (const entry of inner.split(',')) {
      const letter = entry[0];
      const roleCode = MOONBOARD_LETTER_TO_ROLE[letter];
      if (!roleCode) continue;
      const serial = Number(entry.slice(1));
      if (!Number.isFinite(serial)) continue;
      const holdId = moonboardSerialToHoldId(serial);
      if (holdId == null) continue;
      leds.push({ holdId, roleCode });
    }
  }
  leds.sort((a, b) => a.holdId - b.holdId);
  const framesString = leds.map((l) => `p${l.holdId}r${l.roleCode}`).join('');
  return { board: 'moonboard', leds, framesString };
}

// ---- Stateful accumulator ----

export type DecoderConfig = {
  board: BoardName;
  layoutId: number;
  sizeId: number;
};

export class PayloadDecoder {
  private buffer: number[] = [];
  private pendingLeds: DecodedLed[] = [];
  private pendingApiLevel: 2 | 3 = 3;
  private inMultiFrame = false;
  // MoonBoard payloads also get split into 20-byte BLE chunks (the phone calls
  // splitMessages too), so we accumulate ASCII bytes until we see the closing
  // '#' that terminates the `l#…#` frame.
  private mbBuffer = '';

  constructor(private config: DecoderConfig) {}

  setConfig(config: DecoderConfig): void {
    this.config = config;
  }

  reset(): void {
    this.buffer = [];
    this.pendingLeds = [];
    this.inMultiFrame = false;
    this.mbBuffer = '';
  }

  /**
   * Push a chunk of raw BLE bytes (as forwarded by the ESP32). Returns one or
   * more decoded frames if the chunk completes any. Both Aurora and MoonBoard
   * payloads can span multiple BLE writes — we buffer until a complete frame
   * is recoverable.
   */
  push(chunk: Uint8Array): DecodedFrame[] {
    if (this.config.board === 'moonboard') {
      return this.pushMoonboardChunk(chunk);
    }

    // Aurora: accumulate, then drain complete frames.
    for (let i = 0; i < chunk.length; i++) this.buffer.push(chunk[i]);
    return this.drainAuroraFrames();
  }

  private pushMoonboardChunk(chunk: Uint8Array): DecodedFrame[] {
    let text: string;
    try {
      text = new TextDecoder('ascii').decode(chunk);
    } catch {
      return [];
    }
    this.mbBuffer += text;

    const out: DecodedFrame[] = [];
    // Drain every complete `l#…#` frame currently in the buffer. There may be
    // more than one if the phone bursts climbs back-to-back.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const start = this.mbBuffer.indexOf('l#');
      if (start === -1) {
        // No frame start in view — drop accumulated noise so we don't grow
        // unbounded on a stream of garbage.
        if (this.mbBuffer.length > 1024) this.mbBuffer = '';
        break;
      }
      // The closing `#` is the second `#` (the first one is in `l#`).
      const closing = this.mbBuffer.indexOf('#', start + 2);
      if (closing === -1) {
        // Frame still incomplete — keep what we have starting at the prefix.
        if (start > 0) this.mbBuffer = this.mbBuffer.slice(start);
        break;
      }
      const frameText = this.mbBuffer.slice(start, closing + 1);
      this.mbBuffer = this.mbBuffer.slice(closing + 1);
      const decoded = parseCompleteMoonboardAscii(frameText);
      if (decoded) out.push(decoded);
    }
    return out;
  }

  private drainAuroraFrames(): DecodedFrame[] {
    const out: DecodedFrame[] = [];
    while (this.buffer.length > 0) {
      // Resync: drop bytes until we land on SOH.
      while (this.buffer.length > 0 && this.buffer[0] !== FRAME_SOH) {
        this.buffer.shift();
      }
      const view = Uint8Array.from(this.buffer);
      const parsed = parseFrame(view);
      if (!parsed) return out;

      this.buffer.splice(0, parsed.consumed);
      const ledBytes = parsed.payload.subarray(1);

      let leds: DecodedLed[];
      let apiLevel: 2 | 3;

      switch (parsed.command) {
        case V3_PACKET_ONLY:
        case V3_PACKET_FIRST:
        case V3_PACKET_MIDDLE:
        case V3_PACKET_LAST:
          leds = decodeLedDataV3(ledBytes);
          apiLevel = 3;
          break;
        case V2_PACKET_ONLY:
        case V2_PACKET_FIRST:
        case V2_PACKET_MIDDLE:
        case V2_PACKET_LAST:
          leds = decodeLedDataV2(ledBytes);
          apiLevel = 2;
          break;
        default:
          // Unknown command — skip the frame and keep draining.
          continue;
      }

      const isOnly = parsed.command === V3_PACKET_ONLY || parsed.command === V2_PACKET_ONLY;
      const isFirst = parsed.command === V3_PACKET_FIRST || parsed.command === V2_PACKET_FIRST;
      const isLast = parsed.command === V3_PACKET_LAST || parsed.command === V2_PACKET_LAST;

      if (isOnly) {
        out.push(this.buildAuroraFrame(leds, apiLevel));
        this.pendingLeds = [];
        this.inMultiFrame = false;
        continue;
      }

      if (isFirst) {
        this.pendingLeds = leds;
        this.pendingApiLevel = apiLevel;
        this.inMultiFrame = true;
        continue;
      }

      if (this.inMultiFrame) {
        this.pendingLeds.push(...leds);
        if (isLast) {
          out.push(this.buildAuroraFrame(this.pendingLeds, this.pendingApiLevel));
          this.pendingLeds = [];
          this.inMultiFrame = false;
        }
      }
    }
    return out;
  }

  private buildAuroraFrame(leds: DecodedLed[], apiLevel: 2 | 3): DecodedAuroraFrame {
    // Look up placementId for each LED position via the board geometry. Holds
    // we can't map are dropped (with a warning inside buildFramesString).
    const framesString = buildFramesString(
      leds.map((l) => ({ position: l.position, r: l.r, g: l.g, b: l.b })),
      this.config.board,
      this.config.layoutId,
      this.config.sizeId,
    );
    return { board: this.config.board, apiLevel, leds, framesString };
  }
}

// Convenience: decode a single complete payload (e.g. from a unit test where
// the whole packet arrives in one buffer). Useful for round-trip tests.
export function decodeOnce(bytes: Uint8Array, config: DecoderConfig): DecodedFrame | null {
  const decoder = new PayloadDecoder(config);
  const frames = decoder.push(bytes);
  return frames[0] ?? null;
}

// Re-export reverse placements helper for callers building UI tooltips.
export { getReverseLedPlacements };
