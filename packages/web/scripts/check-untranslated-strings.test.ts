import { describe, expect, it } from 'vitest';
import { checkFile, looksTranslatable } from './check-untranslated-strings';

const fakePath = '/tmp/fake-component.tsx';

function scan(source: string) {
  return checkFile(fakePath, source);
}

describe('looksTranslatable', () => {
  it('flags ordinary English prose', () => {
    expect(looksTranslatable('Save')).toBe(true);
    expect(looksTranslatable('Sign in')).toBe(true);
    expect(looksTranslatable('Hello world')).toBe(true);
  });

  it('skips strings that are too short without a space', () => {
    expect(looksTranslatable('OK')).toBe(false);
    expect(looksTranslatable('id')).toBe(false);
    expect(looksTranslatable('BPM')).toBe(false);
  });

  it('skips URLs, emails, paths, hex colors, pure punctuation/numbers', () => {
    expect(looksTranslatable('https://boardsesh.com')).toBe(false);
    expect(looksTranslatable('mailto:foo@bar.com')).toBe(false);
    expect(looksTranslatable('./relative/path')).toBe(false);
    expect(looksTranslatable('#fff')).toBe(false);
    expect(looksTranslatable('#1a2b3c')).toBe(false);
    expect(looksTranslatable('1.2.3')).toBe(false);
    expect(looksTranslatable('   ')).toBe(false);
    expect(looksTranslatable('')).toBe(false);
  });
});

describe('checkFile — JSX text nodes', () => {
  it('flags hardcoded text inside an element', () => {
    const { violations } = scan(`
export default function Foo() {
  return <button>Save</button>;
}
`);
    expect(violations).toHaveLength(1);
    expect(violations[0].kind).toBe('jsx-text');
    expect(violations[0].text).toBe('Save');
  });

  it('passes when wrapped in t()', () => {
    const { violations } = scan(`
import { useTranslation } from 'react-i18next';
export default function Foo() {
  const { t } = useTranslation();
  return <button>{t('actions.save')}</button>;
}
`);
    expect(violations).toHaveLength(0);
  });

  it('passes when wrapped in <Trans>', () => {
    const { violations } = scan(`
import { Trans } from 'react-i18next';
export default function Foo() {
  return <Trans i18nKey="x">Hello <strong>world</strong></Trans>;
}
`);
    expect(violations).toHaveLength(0);
  });

  it('skips text inside <pre>, <code>, <script>, <style>', () => {
    const { violations } = scan(`
export default function Foo() {
  return (
    <div>
      <pre>some code sample with English words</pre>
      <code>another code sample here</code>
    </div>
  );
}
`);
    expect(violations).toHaveLength(0);
  });
});

describe('checkFile — JSX attributes', () => {
  it('flags hardcoded aria-label, placeholder, title, alt, helperText', () => {
    const { violations } = scan(`
export default function Foo() {
  return (
    <>
      <button aria-label="Submit form" />
      <input placeholder="Enter your name" />
      <span title="Edit this climb" />
      <img alt="Profile photo" />
      <div helperText="Pick a board" />
    </>
  );
}
`);
    expect(violations.map((violation) => violation.attribute).sort()).toEqual([
      'alt',
      'aria-label',
      'helperText',
      'placeholder',
      'title',
    ]);
  });

  it('passes when the attribute is wrapped in t()', () => {
    const { violations } = scan(`
export default function Foo({ t }: { t: (key: string) => string }) {
  return <button aria-label={t('actions.submit')} placeholder={t('placeholders.name')} />;
}
`);
    expect(violations).toHaveLength(0);
  });

  it('does not flag dynamic expression attributes', () => {
    const { violations } = scan(`
export default function Foo({ label }: { label: string }) {
  return <button aria-label={label} title={someVar} />;
}
`);
    expect(violations).toHaveLength(0);
  });

  it('does not flag attributes outside the curated list', () => {
    const { violations } = scan(`
export default function Foo() {
  return <div className="hero" id="main" data-testid="root" name="x" type="button" />;
}
`);
    expect(violations).toHaveLength(0);
  });
});

describe('checkFile — imperative call sites', () => {
  it('flags string-literal arg to enqueueSnackbar / showMessage', () => {
    const { violations } = scan(`
export default function Foo({ enqueueSnackbar, showMessage }: any) {
  enqueueSnackbar('Saved successfully');
  showMessage('Something went wrong', 'error');
  return null;
}
`);
    const texts = violations.map((violation) => violation.text);
    expect(texts).toContain('Saved successfully');
    expect(texts).toContain('Something went wrong');
    // 'error' is the severity arg (positional 1) — must NOT be flagged
    expect(texts).not.toContain('error');
  });

  it('flags openAuthModal({ title, description, body, message }) literal props', () => {
    const { violations } = scan(`
export default function Foo({ openAuthModal }: any) {
  openAuthModal({ title: 'Sign in required', description: 'You need an account', icon: 'lock' });
  return null;
}
`);
    expect(violations.map((violation) => violation.text).sort()).toEqual(['Sign in required', 'You need an account']);
  });

  it('passes when openAuthModal receives t() values', () => {
    const { violations } = scan(`
export default function Foo({ openAuthModal, t }: any) {
  openAuthModal({ title: t('auth.title'), description: t('auth.description') });
  return null;
}
`);
    expect(violations).toHaveLength(0);
  });
});

describe('checkFile — ignore markers', () => {
  it('respects // i18n-ignore-next-line on the line above', () => {
    const { violations, staleMarkers } = scan(`
export default function Foo() {
  return (
    <>
      {/* i18n-ignore-next-line */}
      <span>Boardsesh</span>
    </>
  );
}
`);
    expect(violations).toHaveLength(0);
    expect(staleMarkers).toEqual([]);
  });

  it('respects // i18n-ignore-next-line above a JSX attribute', () => {
    const { violations } = scan(`
export default function Foo() {
  return (
    <button
      // i18n-ignore-next-line
      aria-label="Boardsesh"
    />
  );
}
`);
    expect(violations).toHaveLength(0);
  });

  it('reports a stale marker that has no following violation', () => {
    const { violations, staleMarkers } = scan(`
export default function Foo() {
  return (
    <>
      {/* i18n-ignore-next-line */}
      <span>{t('translated.string')}</span>
    </>
  );
}
`);
    expect(violations).toHaveLength(0);
    expect(staleMarkers.length).toBeGreaterThan(0);
  });
});
