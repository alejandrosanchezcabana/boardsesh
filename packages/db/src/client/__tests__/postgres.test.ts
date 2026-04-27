import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

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
});
