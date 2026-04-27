import { GraphQLError } from 'graphql';
import { getInstagramMediaId } from '../lib/instagram-meta';
import { createCircuitBreaker } from '../lib/circuit-breaker';

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

// Hardcoding a desktop User-Agent to scrape Instagram's og:* tags is fragile
// and at the edge of Meta's ToS — IG has historically responded with a
// login-wall HTML to unrecognized clients, in which case the validator
// rejects with the generic error. The circuit breaker below limits the
// blast radius if/when that starts happening at scale; the rate limiter at
// the resolver layer caps per-user abuse. If validation acceptance rates
// drop, revisit by switching to oEmbed + Graph API or removing this
// write-time check entirely (1736's read-time live check still filters
// `gone` posts).
const INSTAGRAM_FETCH_HEADERS = {
  'accept-language': 'en-US,en;q=0.9',
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
};

// Per-process circuit breaker for the canonical-post fetch. If we observe a
// burst of failures (timeouts, non-200, non-HTML, login-wall), stop calling
// out for `cooldownMs` so we don't keep poking IG while it's actively
// rejecting us. While the breaker is open the validator throws the generic
// error immediately — users see "we couldn't verify this Instagram link"
// instead of waiting for a guaranteed-failing fetch.
const validationCircuit = createCircuitBreaker({
  windowMs: 60 * 1000,
  threshold: 10,
  cooldownMs: 5 * 60 * 1000,
  onOpen: (failures, cooldownMs) => {
    console.warn(`[InstagramBetaValidation] circuit OPEN: ${failures} failures in window, cooldown ${cooldownMs}ms`);
  },
});

export const instagramValidationCircuitForTesting = validationCircuit;

const GENERIC_VALIDATION_ERROR =
  "We couldn't verify this Instagram link. Make sure it's a public post or reel that Boardsesh can preview, and that the caption or title mentions the climb name.";

// Extends GraphQLError so the user-facing message survives Yoga's
// `maskedErrors: true` in production. Plain Error subclasses are replaced
// with the generic "Unexpected error." string before reaching the client,
// which would surface as the fallback "Couldn't add video. Try again."
// toast instead of our specific guidance ("post must mention the climb",
// "already linked to <other climb>", etc.).
export class InstagramBetaValidationError extends GraphQLError {
  constructor(message: string) {
    super(message, { extensions: { code: 'INSTAGRAM_BETA_VALIDATION' } });
    this.name = 'InstagramBetaValidationError';
  }
}

export interface InstagramPageMetadata {
  description: string | null;
  imageUrl: string | null;
  mediaId: string | null;
  ogTitle: string | null;
  username: string | null;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&([a-z]+);/gi, (_, entity) => HTML_ENTITY_MAP[entity.toLowerCase()] ?? `&${entity};`);
}

function normalizeText(value: string): string {
  // Strip combining marks (NFKD splits accented chars into base + mark, then
  // we drop the marks). Replace anything that isn't a Unicode letter or
  // number with a single space so non-Latin climb names (Cyrillic, CJK, etc.)
  // survive normalization. Lowercase last because some scripts have
  // case-folding rules but most don't — applying to the whole string is fine.
  return decodeHtmlEntities(value)
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// Word-bounded substring: `needle` must appear with whitespace or string
// edges on both sides in the (already-normalized) haystack. This prevents a
// climb name like "Gravity" from matching unrelated text that happens to
// contain the substring (e.g. "antigravity").
function containsAsWord(haystack: string, needle: string): boolean {
  if (!haystack || !needle) return false;
  if (haystack === needle) return true;
  if (haystack.startsWith(`${needle} `)) return true;
  if (haystack.endsWith(` ${needle}`)) return true;
  return haystack.includes(` ${needle} `);
}

// Word-bounded indexOf for the ordered-token fallback. Returns the start
// index of `needle` if it appears as a whole word at or after `fromIndex`,
// otherwise -1. Necessary because plain indexOf would match "fell" inside
// "befell".
function indexOfWord(haystack: string, needle: string, fromIndex: number): number {
  let cursor = fromIndex;
  while (cursor <= haystack.length) {
    const idx = haystack.indexOf(needle, cursor);
    if (idx === -1) return -1;
    const before = idx === 0 ? ' ' : haystack[idx - 1];
    const afterIdx = idx + needle.length;
    const after = afterIdx >= haystack.length ? ' ' : haystack[afterIdx];
    if (before === ' ' && after === ' ') return idx;
    cursor = idx + 1;
  }
  return -1;
}

// Minimum length per token before we'll allow the ordered-token fallback to
// fire. Short tokens like "the", "to", "for", "up" appear in nearly every
// English Instagram caption, so a climb name like "The Project" or "Power
// Up" would otherwise produce false positives on unrelated posts. Four
// characters keeps "fell", "from", "cut", etc. out of the fallback while
// still allowing genuinely distinguishing words.
const MIN_TOKEN_LENGTH_FOR_FALLBACK = 4;

function containsNormalizedClimbName(haystack: string, climbName: string): boolean {
  const normalizedHaystack = normalizeText(haystack);
  const normalizedClimbName = normalizeText(climbName);

  if (!normalizedHaystack || !normalizedClimbName) return false;
  if (containsAsWord(normalizedHaystack, normalizedClimbName)) return true;

  // Ordered-token fallback handles multi-word names with intervening noise
  // (e.g. "Fell From Heaven" matching "fell down from the heaven"). Only
  // fire it when every token is long enough to be meaningfully
  // distinguishing — otherwise common-word climb names would match almost
  // any English caption.
  const tokens = normalizedClimbName.split(' ').filter(Boolean);
  if (tokens.length < 2) return false;
  if (tokens.some((t) => t.length < MIN_TOKEN_LENGTH_FOR_FALLBACK)) return false;

  let cursor = 0;
  for (const token of tokens) {
    const nextIndex = indexOfWord(normalizedHaystack, token, cursor);
    if (nextIndex === -1) return false;
    cursor = nextIndex + token.length;
  }
  return true;
}

function parseMetaContent(html: string, target: string): string | null {
  const metaTagRegex = /<meta\b[^>]*>/gi;
  const normalizedTarget = target.toLowerCase();

  for (const metaTag of html.match(metaTagRegex) ?? []) {
    // Construct attrRegex inside the loop so its `/g` `lastIndex` state
    // can't carry over between iterations and silently skip a shorter
    // tag's attributes after a longer one.
    const attrRegex = /([a-zA-Z_:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
    const attrs: Record<string, string> = {};
    let match: RegExpExecArray | null;
    while ((match = attrRegex.exec(metaTag)) !== null) {
      attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
    }

    if (attrs.property?.toLowerCase() === normalizedTarget || attrs.name?.toLowerCase() === normalizedTarget) {
      return attrs.content ? decodeHtmlEntities(attrs.content) : null;
    }
  }

  return null;
}

// Instagram's og:title is consistently "<username> on Instagram: <caption…>"
// (with an optional leading "@"). Pull the username out so the caller can
// persist it eagerly when the row is inserted.
function parseUsernameFromOgTitle(ogTitle: string | null): string | null {
  if (!ogTitle) return null;
  const match = ogTitle.match(/^@?([\w.]+)\s+on\s+Instagram\b/i);
  return match?.[1] ?? null;
}

export async function fetchInstagramPageMetadata(url: string): Promise<InstagramPageMetadata> {
  // Short-circuit when the breaker is open — IG is failing us in bulk, so
  // there's no point spending the client's request budget on a likely-doomed
  // fetch. Don't record this as a circuit failure (it isn't a fresh signal).
  if (validationCircuit.isOpen()) {
    throw new InstagramBetaValidationError(GENERIC_VALIDATION_ERROR);
  }

  // Wrap the network leg in a try/catch so timeouts (AbortSignal.timeout),
  // DNS failures, and connection resets surface as InstagramBetaValidationError
  // instead of leaking raw runtime errors to the resolver.
  let response: Response;
  try {
    response = await fetch(url, {
      headers: INSTAGRAM_FETCH_HEADERS,
      redirect: 'follow',
      // Keep the timeout tight so the GraphQL mutation doesn't hang the
      // client when Instagram is slow or rate-limited. A healthy fetch
      // returns in well under a second; the user can retry on transient
      // failures.
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    validationCircuit.recordFailure();
    throw new InstagramBetaValidationError(GENERIC_VALIDATION_ERROR);
  }

  if (!response.ok) {
    validationCircuit.recordFailure();
    throw new InstagramBetaValidationError(GENERIC_VALIDATION_ERROR);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) {
    validationCircuit.recordFailure();
    throw new InstagramBetaValidationError(GENERIC_VALIDATION_ERROR);
  }

  let html: string;
  try {
    html = await response.text();
  } catch {
    validationCircuit.recordFailure();
    throw new InstagramBetaValidationError(GENERIC_VALIDATION_ERROR);
  }

  const description = parseMetaContent(html, 'description') ?? parseMetaContent(html, 'og:description');
  const ogTitle = parseMetaContent(html, 'og:title') ?? parseMetaContent(html, 'twitter:title');
  const imageUrl = parseMetaContent(html, 'og:image') ?? parseMetaContent(html, 'twitter:image');
  const mediaIdFromAppUrl = parseMetaContent(html, 'al:ios:url')?.match(/instagram:\/\/media\?id=(\d+)/)?.[1] ?? null;

  if (!description && !ogTitle) {
    // 200 OK with no og data usually means IG served a login-wall page.
    // Treat it as a transient failure for breaker purposes so a sustained
    // wall response trips the cooldown.
    validationCircuit.recordFailure();
    throw new InstagramBetaValidationError(GENERIC_VALIDATION_ERROR);
  }

  return {
    description,
    imageUrl,
    mediaId: mediaIdFromAppUrl ?? getInstagramMediaId(url),
    ogTitle,
    username: parseUsernameFromOgTitle(ogTitle),
  };
}

export async function validateInstagramBetaLink(url: string, climbName: string): Promise<InstagramPageMetadata> {
  const metadata = await fetchInstagramPageMetadata(url);

  // mediaId is the canonical identity for the post (used for dedup + S3 cache
  // key), so without it we can't safely persist. imageUrl is just enrichment —
  // a public post with a caption mentioning the climb name should pass even
  // if og:image happens to be missing.
  if (!metadata.mediaId) {
    throw new InstagramBetaValidationError(GENERIC_VALIDATION_ERROR);
  }

  const searchableText = [metadata.ogTitle, metadata.description].filter(Boolean).join(' ');
  if (!containsNormalizedClimbName(searchableText, climbName)) {
    throw new InstagramBetaValidationError(
      `We couldn't confirm this video is for "${climbName}". Please use a public Instagram post or reel whose caption or title mentions the climb name.`,
    );
  }

  return metadata;
}

export const instagramBetaValidationInternals = {
  containsAsWord,
  containsNormalizedClimbName,
  decodeHtmlEntities,
  indexOfWord,
  normalizeText,
  parseMetaContent,
  parseUsernameFromOgTitle,
};
