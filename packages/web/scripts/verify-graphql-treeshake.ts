#!/usr/bin/env node
/**
 * After `next build`, assert that the SWC client-preset plugin actually
 * tree-shook the gql.ts Documents map. A wrong `artifactDirectory` in
 * next.config.mjs (or a missing plugin entirely) silently no-ops the
 * transform, so we need a positive check.
 *
 * Strategy: parse generated/gql.ts to learn every operation name in the
 * project, parse account.ts to learn the names that are *supposed* to be
 * in the settings chunk (the only graphql() call site today), then assert
 * that the rest don't appear there. As more operations migrate to
 * graphql(), the absence list shrinks automatically — no maintenance.
 *
 * Operation names survive bundling as string literals inside the parsed
 * Document AST (e.g. `name:{kind:"Name",value:"GetBetaLinks"}`), even
 * though the *Document import identifiers get minified.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, '..');
const chunksDir = join(webRoot, '.next', 'static', 'chunks');
const gqlPath = join(webRoot, 'app', 'lib', 'graphql', 'generated', 'gql.ts');
// account.ts is the single graphql() call site as of this PR. If/when more
// op files migrate, swap this for a glob over operations/*.ts — the
// derivation below treats every operation in that file as "must be present
// in the marker chunk", so adding files extends coverage automatically.
const accountPath = join(webRoot, 'app', 'lib', 'graphql', 'operations', 'account.ts');

function fail(message: string): never {
  console.error(`verify-graphql-treeshake: ${message}`);
  process.exit(1);
}

function extractOperationNames(source: string): string[] {
  // Matches `query Name`, `mutation Name`, and `subscription Name` inside
  // graphql template literals. Captures the identifier only.
  const matches = source.matchAll(/\b(?:query|mutation|subscription)\s+([A-Z]\w+)/g);
  return [...new Set(Array.from(matches, (m) => m[1]))];
}

const allOperationNames = extractOperationNames(readFileSync(gqlPath, 'utf8'));
const liveOperationNames = extractOperationNames(readFileSync(accountPath, 'utf8'));
if (liveOperationNames.length === 0) {
  fail(`could not parse operation names from ${accountPath}`);
}
const [marker] = liveOperationNames;
const mustBeAbsent = allOperationNames.filter((name) => !liveOperationNames.includes(name));

if (mustBeAbsent.length === 0) {
  fail(`no candidate operations to verify against; gql.ts only contains operations that account.ts uses`);
}

// Recursive: Next App Router can split chunks into per-route subdirectories
// (e.g. .next/static/chunks/app/...) depending on version and routing config.
let chunkNames: string[];
try {
  chunkNames = readdirSync(chunksDir, { recursive: true })
    .map((entry) => (typeof entry === 'string' ? entry : entry.toString()))
    .filter((name) => name.endsWith('.js'));
} catch {
  fail(`chunks directory not found at ${chunksDir}; run \`vp run build:web\` first`);
}

const chunkContent = new Map<string, string>();
function read(name: string): string {
  let content = chunkContent.get(name);
  if (content === undefined) {
    content = readFileSync(join(chunksDir, name), 'utf8');
    chunkContent.set(name, content);
  }
  return content;
}

const markerChunks = chunkNames.filter((name) => read(name).includes(marker));

if (markerChunks.length === 0) {
  fail(`no chunk contains ${marker}; account.ts may not have been bundled — did the build complete?`);
}

const leaks: { chunk: string; size: number; queries: string[] }[] = [];
for (const name of markerChunks) {
  const content = read(name);
  const queries = mustBeAbsent.filter((q) => content.includes(q));
  if (queries.length > 0) {
    leaks.push({ chunk: name, size: statSync(join(chunksDir, name)).size, queries });
  }
}

if (leaks.length > 0) {
  console.error('SWC plugin transform did not fire — Documents map leaked into settings chunk(s):');
  for (const { chunk, size, queries } of leaks) {
    const shown = queries.slice(0, 5).join(', ');
    const extra = queries.length > 5 ? `, +${queries.length - 5} more` : '';
    console.error(`  ${chunk} (${size} B): ${shown}${extra}`);
  }
  console.error('Check artifactDirectory in packages/web/next.config.mjs.');
  process.exit(1);
}

const totalSize = markerChunks.reduce((sum, name) => sum + statSync(join(chunksDir, name)).size, 0);
console.info(
  `verify-graphql-treeshake: OK — ${markerChunks.length} chunk(s) carry ${marker} ` +
    `(${totalSize} B total), ${mustBeAbsent.length} unrelated operation(s) checked, none leaked.`,
);
