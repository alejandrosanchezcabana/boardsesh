import { describe, expect, it } from 'vitest';
import { alreadyPrefixed, applyLocale, localeHref, shouldPassThrough, stripLocalePrefix } from '../locale-href';

describe('localeHref', () => {
  it('passes through default locale unchanged', () => {
    expect(localeHref('/foo', 'en-US')).toBe('/foo');
    expect(localeHref('/', 'en-US')).toBe('/');
  });

  it('prefixes non-default locale paths', () => {
    expect(localeHref('/foo', 'es')).toBe('/es/foo');
    expect(localeHref('/', 'es')).toBe('/es');
  });

  it('handles relative paths', () => {
    expect(localeHref('foo', 'es')).toBe('/es/foo');
  });
});

describe('stripLocalePrefix', () => {
  it('returns input untouched for default locale', () => {
    expect(stripLocalePrefix('/es/foo', 'en-US')).toBe('/es/foo');
  });

  it('strips non-default prefix', () => {
    expect(stripLocalePrefix('/es/foo', 'es')).toBe('/foo');
    expect(stripLocalePrefix('/es', 'es')).toBe('/');
  });

  it('leaves unprefixed paths alone', () => {
    expect(stripLocalePrefix('/foo', 'es')).toBe('/foo');
  });
});

describe('shouldPassThrough', () => {
  it.each([
    ['/api/auth/signin', true],
    ['/api/v1/foo', true],
    ['https://example.com', true],
    ['http://example.com', true],
    ['//cdn.example.com/x', true],
    ['mailto:hi@example.com', true],
    ['tel:+1234', true],
    ['#anchor', true],
    ['', true],
    ['/foo', false],
    ['/about', false],
    ['/api', false],
  ])('shouldPassThrough(%j) -> %s', (href, expected) => {
    expect(shouldPassThrough(href)).toBe(expected);
  });
});

describe('alreadyPrefixed', () => {
  it.each([
    ['/es', true],
    ['/es/', true],
    ['/es/foo', true],
    ['/es?x=1', true],
    ['/foo', false],
    ['/established', false],
    ['/api/foo', false],
  ])('alreadyPrefixed(%j) -> %s', (href, expected) => {
    expect(alreadyPrefixed(href)).toBe(expected);
  });
});

describe('applyLocale', () => {
  it('passes /api/* through unchanged regardless of active locale', () => {
    expect(applyLocale('/api/auth/signin', 'es')).toBe('/api/auth/signin');
    expect(applyLocale('/api/v1/x', 'es')).toBe('/api/v1/x');
  });

  it('passes external schemes through', () => {
    expect(applyLocale('https://example.com', 'es')).toBe('https://example.com');
    expect(applyLocale('mailto:hi@example.com', 'es')).toBe('mailto:hi@example.com');
    expect(applyLocale('#section', 'es')).toBe('#section');
  });

  it('prefixes plain in-app paths to the active non-default locale', () => {
    expect(applyLocale('/foo', 'es')).toBe('/es/foo');
    expect(applyLocale('/', 'es')).toBe('/es');
  });

  it('does not prefix when the active locale is default', () => {
    expect(applyLocale('/foo', 'en-US')).toBe('/foo');
    expect(applyLocale('/es/foo', 'en-US')).toBe('/foo');
  });

  it('avoids double-prefixing already-prefixed paths', () => {
    expect(applyLocale('/es/foo', 'es')).toBe('/es/foo');
    expect(applyLocale('/es', 'es')).toBe('/es');
  });
});
