import { describe, it, expect } from 'vite-plus/test';
import { parseSerialNumber, parseBoardTypeFromDeviceName } from '../bluetooth-aurora';

describe('parseSerialNumber', () => {
  it('extracts serial from standard Aurora format "Name#Serial@APILevel"', () => {
    expect(parseSerialNumber('Kilter Board#751737@3')).toBe('751737');
  });

  it('extracts serial when @APILevel is absent', () => {
    expect(parseSerialNumber('Kilter Board#751737')).toBe('751737');
  });

  it('handles alphanumeric serial numbers', () => {
    expect(parseSerialNumber('Tension Board#ABC123@2')).toBe('ABC123');
  });

  it('returns undefined when no # separator exists', () => {
    expect(parseSerialNumber('Kilter Board')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(parseSerialNumber('')).toBeUndefined();
  });

  it('returns undefined for undefined input', () => {
    expect(parseSerialNumber(undefined)).toBeUndefined();
  });

  it('handles device name with no display name prefix', () => {
    expect(parseSerialNumber('#serial@1')).toBe('serial');
  });
});

describe('parseBoardTypeFromDeviceName', () => {
  it('identifies kilter boards', () => {
    expect(parseBoardTypeFromDeviceName('Kilter Board#751737@3')).toBe('kilter');
  });

  it('identifies kilter boards case-insensitively', () => {
    expect(parseBoardTypeFromDeviceName('kilter board#123')).toBe('kilter');
  });

  it('identifies tension boards', () => {
    expect(parseBoardTypeFromDeviceName('Tension Board#123@2')).toBe('tension');
  });

  it('identifies tension boards in uppercase', () => {
    expect(parseBoardTypeFromDeviceName('TENSION BOARD')).toBe('tension');
  });

  it('identifies decoy boards', () => {
    expect(parseBoardTypeFromDeviceName('Decoy Board#999@3')).toBe('decoy');
  });

  it('identifies touchstone boards', () => {
    expect(parseBoardTypeFromDeviceName('Touchstone Board#456@2')).toBe('touchstone');
  });

  it('identifies grasshopper boards', () => {
    expect(parseBoardTypeFromDeviceName('Grasshopper Board#789@1')).toBe('grasshopper');
  });

  it('returns undefined for moonboard (not handled by this function)', () => {
    expect(parseBoardTypeFromDeviceName('MoonBoard 123')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(parseBoardTypeFromDeviceName('')).toBeUndefined();
  });

  it('returns undefined for undefined input', () => {
    expect(parseBoardTypeFromDeviceName(undefined)).toBeUndefined();
  });

  it('returns undefined for unknown device name', () => {
    expect(parseBoardTypeFromDeviceName('Random Device')).toBeUndefined();
  });
});
