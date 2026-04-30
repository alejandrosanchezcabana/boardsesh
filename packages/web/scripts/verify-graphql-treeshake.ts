#!/usr/bin/env node
/**
 * After `next build`, assert that the SWC client-preset plugin actually
 * tree-shook the gql.ts Documents map. A wrong `artifactDirectory` in
 * next.config.mjs silently no-ops the plugin, so we need a positive check.
 *
 * The marker is `GetDeleteAccountInfoDocument` — the only graphql() call
 * site today (account.ts → delete-account-section.tsx → /settings).
 * If the plugin worked, the chunk holding that import must NOT contain
 * unrelated operation names that only the full Documents map would pull in.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const chunksDir = join(here, '..', '.next', 'static', 'chunks');

// Query names survive bundling as string literals inside the parsed Document
// AST. Import identifiers like *Document are minified, so we grep for the
// operation name, which is stable across builds.
const MARKER = 'GetDeleteAccountInfo';
const MUST_BE_ABSENT = [
  'GetBetaLinks',
  'GetGlobalCommentFeed',
  'GetUserAscentsFeed',
  'UserFavoritesCounts',
  'GetNewClimbFeed',
];

function fail(message: string): never {
  console.error(`verify-graphql-treeshake: ${message}`);
  process.exit(1);
}

let chunks: string[];
try {
  chunks = readdirSync(chunksDir).filter((name) => name.endsWith('.js'));
} catch {
  fail(`chunks directory not found at ${chunksDir}; run \`vp run build:web\` first`);
}

const markerChunks = chunks.filter((name) => {
  const content = readFileSync(join(chunksDir, name), 'utf8');
  return content.includes(MARKER);
});

if (markerChunks.length === 0) {
  fail(`no chunk contains ${MARKER}; account.ts may not have been bundled — did the build complete?`);
}

const leaks: { chunk: string; size: number; queries: string[] }[] = [];
for (const name of markerChunks) {
  const path = join(chunksDir, name);
  const content = readFileSync(path, 'utf8');
  const queries = MUST_BE_ABSENT.filter((q) => content.includes(q));
  if (queries.length > 0) {
    leaks.push({ chunk: name, size: statSync(path).size, queries });
  }
}

if (leaks.length > 0) {
  console.error('SWC plugin transform did not fire — Documents map leaked into settings chunk(s):');
  for (const { chunk, size, queries } of leaks) {
    console.error(`  ${chunk} (${size} B): ${queries.join(', ')}`);
  }
  console.error('Check artifactDirectory in packages/web/next.config.mjs.');
  process.exit(1);
}

const totalSize = markerChunks.reduce((sum, name) => sum + statSync(join(chunksDir, name)).size, 0);
console.info(
  `verify-graphql-treeshake: OK — ${markerChunks.length} chunk(s) carry ${MARKER} ` +
    `(${totalSize} B total), no unrelated operations leaked.`,
);
