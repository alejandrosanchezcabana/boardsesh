import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  commandCountFromResult,
  executeCommandCount,
  executeFirstRow,
  executeRows,
  firstRowFromResult,
  rowsFromResult,
} from '../postgres';

void describe('postgres result helpers', () => {
  void it('returns postgres-js row arrays directly', () => {
    const rows = [{ id: 1 }, { id: 2 }];

    assert.deepEqual(rowsFromResult<{ id: number }>(rows), rows);
    assert.deepEqual(firstRowFromResult<{ id: number }>(rows), { id: 1 });
  });

  void it('throws on unknown result shapes', () => {
    assert.throws(() => rowsFromResult<{ id: number }>({ result: [{ id: 1 }] }), TypeError);
    assert.throws(() => rowsFromResult<{ id: number }>({ rows: [{ id: 1 }] }), TypeError);
  });

  void it('executes queries and normalizes rows', async () => {
    const conn = {
      execute: async () => [{ id: 1 }],
    };

    assert.deepEqual(await executeRows<{ id: number }>(conn, 'select 1'), [{ id: 1 }]);
    assert.deepEqual(await executeFirstRow<{ id: number }>(conn, 'select 1'), { id: 1 });
  });

  void it('reads command counts from postgres-js and node-postgres metadata', async () => {
    assert.equal(commandCountFromResult({ count: 3 }), 3);
    assert.equal(commandCountFromResult({ rowCount: 4 }), 4);
    assert.equal(commandCountFromResult({}), undefined);

    const conn = {
      execute: async () => ({ count: 5 }),
    };
    assert.equal(await executeCommandCount(conn, 'update table set x = 1'), 5);
  });
});
