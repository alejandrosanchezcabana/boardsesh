import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Ensure the client factories have a connection string they can hand to
// postgres-js. The clients don't actually open a TCP connection until a query
// runs, so a fake URL is fine for these structural tests.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgres://postgres:password@localhost:5432/main';
}

void describe('postgres client', () => {
  void describe('closePool', () => {
    void it('should be a function export', async () => {
      const { closePool } = await import('../postgres');
      assert.equal(typeof closePool, 'function');
    });

    void it('should resolve without error when no pool exists', async () => {
      const { closePool } = await import('../postgres');
      await assert.doesNotReject(() => closePool());
    });

    void it('should reset db singleton so createDb creates a fresh instance', async () => {
      const { createDb, closePool } = await import('../postgres');

      const db1 = createDb();
      assert.ok(db1, 'createDb should return a db instance');

      await closePool();

      const db2 = createDb();
      assert.ok(db2, 'createDb should return a new db instance after closePool');

      await closePool();
    });
  });

  void describe('createPool configuration', () => {
    void it('should return the same pool instance on repeated calls', async () => {
      const { createPool } = await import('../postgres');
      const pool1 = createPool();
      const pool2 = createPool();
      assert.equal(pool1, pool2, 'createPool should return the same singleton');
    });
  });

  void describe('read replica fallback', () => {
    void it('createReadDb returns the primary db when READ_REPLICA_URL is unset', async () => {
      const previous = process.env.READ_REPLICA_URL;
      delete process.env.READ_REPLICA_URL;
      try {
        const { createDb, createReadDb, closePool, closeReadPool } = await import('../postgres');
        await closePool();
        await closeReadPool();
        const primary = createDb();
        const reader = createReadDb();
        assert.equal(reader, primary, 'createReadDb should fall back to the primary db');
        await closeReadPool();
        await closePool();
      } finally {
        if (previous !== undefined) process.env.READ_REPLICA_URL = previous;
      }
    });

    void it('createReadDb returns a separate instance when READ_REPLICA_URL is set', async () => {
      const previous = process.env.READ_REPLICA_URL;
      process.env.READ_REPLICA_URL = 'postgres://postgres:password@localhost:5432/main';
      try {
        const { createDb, createReadDb, closePool, closeReadPool } = await import('../postgres');
        await closePool();
        await closeReadPool();
        const primary = createDb();
        const reader = createReadDb();
        assert.notEqual(reader, primary, 'read db should be a separate drizzle instance');
        await closeReadPool();
        await closePool();
      } finally {
        if (previous === undefined) delete process.env.READ_REPLICA_URL;
        else process.env.READ_REPLICA_URL = previous;
      }
    });

    void it('closeReadPool resolves without error when no read pool exists', async () => {
      const { closeReadPool } = await import('../postgres');
      await assert.doesNotReject(() => closeReadPool());
    });
  });
});
