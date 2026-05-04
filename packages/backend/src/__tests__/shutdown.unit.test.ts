import { describe, it, expect } from 'vite-plus/test';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// These are unit tests that verify the shutdown plumbing is wired correctly
// without requiring a database connection.

const ROOT = resolve(__dirname, '../..');

function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf-8');
}

describe('shutdown: closePool wiring', () => {
  it('index.ts imports closePool and closeReadPool from @boardsesh/db/client', () => {
    const source = readSource('src/index.ts');
    expect(source).toContain("import { closePool, closeReadPool } from '@boardsesh/db/client'");
    expect(source).toContain('await closePool()');
    expect(source).toContain('await closeReadPool()');
  });

  it('index.ts logs when pools are closed', () => {
    const source = readSource('src/index.ts');
    expect(source).toContain("'Database pools closed'");
  });

  it('index.ts handles pool close errors gracefully', () => {
    const source = readSource('src/index.ts');
    // closePool should be in a try/catch
    expect(source).toContain("'Error closing database pools:'");
  });

  it('index.ts closes read pool before primary pool', () => {
    const source = readSource('src/index.ts');
    const readIdx = source.indexOf('await closeReadPool()');
    const primaryIdx = source.indexOf('await closePool()');
    expect(readIdx).toBeGreaterThanOrEqual(0);
    expect(readIdx).toBeLessThan(primaryIdx);
  });
});

describe('shutdown: server resources interface', () => {
  const serverSource = readSource('src/server.ts');

  it('exports ServerResources with cleanupIntervals and shutdownServices', () => {
    expect(serverSource).toContain('cleanupIntervals: () => void');
    expect(serverSource).toContain('shutdownServices: () => Promise<void>');
  });

  it('returns cleanupIntervals and shutdownServices from startServer', () => {
    expect(serverSource).toContain('return { wss, httpServer, cleanupIntervals, shutdownServices }');
  });

  it('does not register its own SIGTERM/SIGINT handlers', () => {
    // server.ts should not have process.on('SIGTERM'/'SIGINT') — that's index.ts's job
    const sigTermMatches = serverSource.match(/process\.on\(['"]SIGTERM['"]/g);
    const sigIntMatches = serverSource.match(/process\.on\(['"]SIGINT['"]/g);
    expect(sigTermMatches).toBeNull();
    expect(sigIntMatches).toBeNull();
  });
});

describe('shutdown: re-entrancy guard', () => {
  it('index.ts prevents double shutdown', () => {
    const source = readSource('src/index.ts');
    expect(source).toContain('shuttingDown');
  });
});

describe('shutdown: ordering', () => {
  it('index.ts shuts down services before closing the pool', () => {
    const source = readSource('src/index.ts');
    const servicesIdx = source.indexOf('shutdownServices');
    const poolIdx = source.indexOf('closePool()');
    expect(servicesIdx).toBeLessThan(poolIdx);
  });

  it('index.ts closes HTTP/WS before closing the pool', () => {
    const source = readSource('src/index.ts');
    const httpIdx = source.indexOf('httpServer.close');
    const poolIdx = source.indexOf('closePool()');
    expect(httpIdx).toBeLessThan(poolIdx);
  });
});

describe('pool configuration', () => {
  it('idle_timeout is 30 seconds', () => {
    const source = readFileSync(resolve(ROOT, '../db/src/client/postgres.ts'), 'utf-8');
    expect(source).toContain('idle_timeout: 30');
  });
});

describe('closePool implementation', () => {
  const source = readFileSync(resolve(ROOT, '../db/src/client/postgres.ts'), 'utf-8');

  it('is exported from postgres.ts', () => {
    expect(source).toContain('export async function closePool()');
  });

  it('ends the client and resets to null', () => {
    expect(source).toContain('await client.end()');
    expect(source).toContain('client = null');
  });

  it('resets db singleton to null', () => {
    expect(source).toContain('db = null');
  });

  it('uses try/finally to ensure singletons are nulled even if .end() throws', () => {
    const tryCount = (source.match(/try\s*\{/g) ?? []).length;
    const finallyCount = (source.match(/finally\s*\{/g) ?? []).length;
    expect(finallyCount).toBeGreaterThanOrEqual(1);
    expect(tryCount).toBeGreaterThanOrEqual(finallyCount);
  });

  it('is re-exported from client/index.ts', () => {
    const indexSource = readFileSync(resolve(ROOT, '../db/src/client/index.ts'), 'utf-8');
    expect(indexSource).toContain('closePool');
  });

  it('closeReadPool is exported and re-exported', () => {
    expect(source).toContain('export async function closeReadPool()');
    const indexSource = readFileSync(resolve(ROOT, '../db/src/client/index.ts'), 'utf-8');
    expect(indexSource).toContain('closeReadPool');
  });

  it('postgres-js clients are configured with prepare:false for PgBouncer', () => {
    expect(source).toContain('prepare: false');
  });
});
