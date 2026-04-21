import { describe, it, expect, vi } from "vite-plus/test";
import { readFileSync } from "fs";
import { resolve } from "path";

// These are unit tests that verify the shutdown plumbing is wired correctly
// without requiring a database connection.

const ROOT = resolve(__dirname, "../..");

function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf-8");
}

describe("shutdown: closePool wiring", () => {
  it("index.ts imports and calls closePool from @boardsesh/db/client", () => {
    const source = readSource("src/index.ts");
    expect(source).toContain("import { closePool } from '@boardsesh/db/client'");
    expect(source).toContain("await closePool()");
  });

  it("index.ts logs when pool is closed", () => {
    const source = readSource("src/index.ts");
    expect(source).toContain("'Database pool closed'");
  });

  it("index.ts handles closePool errors gracefully", () => {
    const source = readSource("src/index.ts");
    // closePool should be in a try/catch
    expect(source).toContain("'Error closing database pool:'");
  });
});

describe("shutdown: server resources interface", () => {
  const serverSource = readSource("src/server.ts");

  it("exports ServerResources with cleanupIntervals and shutdownServices", () => {
    expect(serverSource).toContain("cleanupIntervals: () => void");
    expect(serverSource).toContain("shutdownServices: () => Promise<void>");
  });

  it("returns cleanupIntervals and shutdownServices from startServer", () => {
    expect(serverSource).toContain(
      "return { wss, httpServer, cleanupIntervals, shutdownServices }",
    );
  });

  it("does not register its own SIGTERM/SIGINT handlers", () => {
    // server.ts should not have process.on('SIGTERM'/'SIGINT') — that's index.ts's job
    const sigTermMatches = serverSource.match(/process\.on\(['"]SIGTERM['"]/g);
    const sigIntMatches = serverSource.match(/process\.on\(['"]SIGINT['"]/g);
    expect(sigTermMatches).toBeNull();
    expect(sigIntMatches).toBeNull();
  });
});

describe("shutdown: re-entrancy guard", () => {
  it("index.ts prevents double shutdown", () => {
    const source = readSource("src/index.ts");
    expect(source).toContain("shuttingDown");
  });
});

describe("shutdown: ordering", () => {
  it("index.ts shuts down services before closing the pool", () => {
    const source = readSource("src/index.ts");
    const servicesIdx = source.indexOf("shutdownServices");
    const poolIdx = source.indexOf("closePool()");
    expect(servicesIdx).toBeLessThan(poolIdx);
  });

  it("index.ts closes HTTP/WS before closing the pool", () => {
    const source = readSource("src/index.ts");
    const httpIdx = source.indexOf("httpServer.close");
    const poolIdx = source.indexOf("closePool()");
    expect(httpIdx).toBeLessThan(poolIdx);
  });
});

describe("pool configuration", () => {
  it("idleTimeoutMillis is 30 seconds (not the old 120s)", () => {
    const neonSource = readFileSync(resolve(ROOT, "../db/src/client/neon.ts"), "utf-8");
    expect(neonSource).toContain("idleTimeoutMillis: 30000");
    expect(neonSource).not.toContain("idleTimeoutMillis: 120000");
  });
});

describe("closePool implementation", () => {
  const neonSource = readFileSync(resolve(ROOT, "../db/src/client/neon.ts"), "utf-8");

  it("is exported from neon.ts", () => {
    expect(neonSource).toContain("export async function closePool()");
  });

  it("ends the pool and resets to null", () => {
    expect(neonSource).toContain("await pool.end()");
    expect(neonSource).toContain("pool = null");
  });

  it("ends postgresClient and resets to null", () => {
    expect(neonSource).toContain("postgresClient.end()");
    expect(neonSource).toContain("postgresClient = null");
  });

  it("resets db singleton to null", () => {
    expect(neonSource).toContain("db = null");
  });

  it("uses try/finally to ensure singletons are nulled even if .end() throws", () => {
    // Each .end() call should be in a try/finally so the singleton is always reset
    const tryCount = (neonSource.match(/try\s*\{/g) ?? []).length;
    const finallyCount = (neonSource.match(/finally\s*\{/g) ?? []).length;
    // closePool should have at least 2 try/finally blocks (pool + postgresClient)
    expect(finallyCount).toBeGreaterThanOrEqual(2);
    expect(tryCount).toBeGreaterThanOrEqual(finallyCount);
  });

  it("is re-exported from client/index.ts", () => {
    const indexSource = readFileSync(resolve(ROOT, "../db/src/client/index.ts"), "utf-8");
    expect(indexSource).toContain("closePool");
  });
});
