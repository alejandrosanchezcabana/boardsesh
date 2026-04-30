import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { typeDefs } from '../src/schema/index';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, '..', 'src', 'generated', 'schema.graphql');

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, typeDefs.join('\n\n'), 'utf-8');

console.info(`[print-schema] Wrote SDL to ${outPath}`);
