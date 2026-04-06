import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeWithLatestWins,
  createLatestWinsMutationRefs,
  type LatestWinsMutationRefs,
} from '../use-queue-mutations';

interface TestArgs {
  id: string;
  value: number;
}

function createDeferredExecute() {
  const calls: {
    args: TestArgs;
    resolve: () => void;
    reject: (error: Error) => void;
  }[] = [];

  const executeFn = vi.fn((args: TestArgs) => {
    return new Promise<void>((resolve, reject) => {
      calls.push({ args, resolve, reject });
    });
  });

  return { executeFn, calls };
}

/** Wait for a specific call index to appear in the calls array */
async function waitForCall(calls: { args: TestArgs }[], index: number, timeoutMs = 1000) {
  const start = Date.now();
  while (calls.length <= index) {
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for call ${index}`);
    await new Promise(r => setTimeout(r, 5));
  }
}

describe('executeWithLatestWins', () => {
  let refs: LatestWinsMutationRefs<TestArgs>;

  beforeEach(() => {
    refs = createLatestWinsMutationRefs<TestArgs>();
  });

  it('executes a single call immediately', async () => {
    const { executeFn, calls } = createDeferredExecute();

    const promise = executeWithLatestWins(refs, { id: 'a', value: 1 }, executeFn);

    expect(executeFn).toHaveBeenCalledTimes(1);
    expect(calls[0].args).toEqual({ id: 'a', value: 1 });

    calls[0].resolve();
    await promise;

    expect(refs.inFlightRef.current).toBe(false);
    expect(refs.pendingRef.current).toBeNull();
  });

  it('queues the second call and executes it after the first completes', async () => {
    const { executeFn, calls } = createDeferredExecute();

    const promise1 = executeWithLatestWins(refs, { id: 'a', value: 1 }, executeFn);
    const promise2 = executeWithLatestWins(refs, { id: 'b', value: 2 }, executeFn);

    // Only the first call should have been executed so far
    expect(executeFn).toHaveBeenCalledTimes(1);
    expect(calls[0].args).toEqual({ id: 'a', value: 1 });

    // Second call should have returned immediately (coalesced)
    await promise2;

    // Complete the first call - drain loop starts and calls executeFn('b')
    calls[0].resolve();
    await waitForCall(calls, 1);

    expect(executeFn).toHaveBeenCalledTimes(2);
    expect(calls[1].args).toEqual({ id: 'b', value: 2 });

    // Complete the second call so promise1's drain loop finishes
    calls[1].resolve();
    await promise1;

    expect(refs.inFlightRef.current).toBe(false);
    expect(refs.pendingRef.current).toBeNull();
  });

  it('supersedes intermediate calls - only the latest is sent', async () => {
    const { executeFn, calls } = createDeferredExecute();

    const promise1 = executeWithLatestWins(refs, { id: 'a', value: 1 }, executeFn);
    // These two arrive while 'a' is in-flight
    executeWithLatestWins(refs, { id: 'b', value: 2 }, executeFn);
    executeWithLatestWins(refs, { id: 'c', value: 3 }, executeFn);

    // Only 'a' should have been sent
    expect(executeFn).toHaveBeenCalledTimes(1);
    // Pending should be 'c' (latest), not 'b'
    expect(refs.pendingRef.current).toEqual({ id: 'c', value: 3 });

    // Complete 'a' - drain sends 'c' (skipping 'b')
    calls[0].resolve();
    await waitForCall(calls, 1);

    expect(executeFn).toHaveBeenCalledTimes(2);
    expect(calls[1].args).toEqual({ id: 'c', value: 3 });

    calls[1].resolve();
    await promise1;

    expect(refs.inFlightRef.current).toBe(false);
  });

  it('drains pending after the first call errors', async () => {
    const { executeFn, calls } = createDeferredExecute();

    const promise1 = executeWithLatestWins(refs, { id: 'a', value: 1 }, executeFn);
    executeWithLatestWins(refs, { id: 'b', value: 2 }, executeFn);

    expect(executeFn).toHaveBeenCalledTimes(1);

    // First call errors - drain loop should still send 'b'
    calls[0].reject(new Error('network error'));
    await waitForCall(calls, 1);

    expect(executeFn).toHaveBeenCalledTimes(2);
    expect(calls[1].args).toEqual({ id: 'b', value: 2 });

    calls[1].resolve();
    await promise1;

    expect(refs.inFlightRef.current).toBe(false);
  });

  it('resets inFlight after drain error so subsequent calls work', async () => {
    const { executeFn, calls } = createDeferredExecute();

    const promise1 = executeWithLatestWins(refs, { id: 'a', value: 1 }, executeFn);
    executeWithLatestWins(refs, { id: 'b', value: 2 }, executeFn);

    // Complete 'a' - drain starts sending 'b'
    calls[0].resolve();
    await waitForCall(calls, 1);

    // 'b' is now in-flight in the drain; make it error
    calls[1].reject(new Error('drain error'));
    await promise1;

    expect(refs.inFlightRef.current).toBe(false);

    // A new call should work normally
    const promise3 = executeWithLatestWins(refs, { id: 'c', value: 3 }, executeFn);
    expect(executeFn).toHaveBeenCalledTimes(3);
    expect(calls[2].args).toEqual({ id: 'c', value: 3 });

    calls[2].resolve();
    await promise3;

    expect(refs.inFlightRef.current).toBe(false);
  });

  it('handles many rapid calls - only first and last are sent', async () => {
    const { executeFn, calls } = createDeferredExecute();

    const promise1 = executeWithLatestWins(refs, { id: 'a', value: 1 }, executeFn);
    for (let i = 2; i <= 10; i++) {
      executeWithLatestWins(refs, { id: String.fromCharCode(96 + i), value: i }, executeFn);
    }

    // Only 'a' should be in-flight
    expect(executeFn).toHaveBeenCalledTimes(1);
    // Pending should be the last one (j=10)
    expect(refs.pendingRef.current).toEqual({ id: 'j', value: 10 });

    // Complete 'a' - drain sends 'j'
    calls[0].resolve();
    await waitForCall(calls, 1);

    expect(executeFn).toHaveBeenCalledTimes(2);
    expect(calls[1].args).toEqual({ id: 'j', value: 10 });

    calls[1].resolve();
    await promise1;

    // Total: only 2 mutations sent for 10 calls
    expect(executeFn).toHaveBeenCalledTimes(2);
    expect(refs.inFlightRef.current).toBe(false);
  });

  it('coalesced calls resolve immediately without error', async () => {
    const { executeFn, calls } = createDeferredExecute();

    const promise1 = executeWithLatestWins(refs, { id: 'a', value: 1 }, executeFn);

    // These should resolve immediately without throwing
    const result2 = await executeWithLatestWins(refs, { id: 'b', value: 2 }, executeFn);
    const result3 = await executeWithLatestWins(refs, { id: 'c', value: 3 }, executeFn);

    expect(result2).toBeUndefined();
    expect(result3).toBeUndefined();

    // Clean up: resolve 'a', drain sends 'c' (latest), resolve 'c'
    calls[0].resolve();
    await waitForCall(calls, 1);
    calls[1].resolve();
    await promise1;
  });

  it('handles a new call arriving during drain execution', async () => {
    const { executeFn, calls } = createDeferredExecute();

    const promise1 = executeWithLatestWins(refs, { id: 'a', value: 1 }, executeFn);
    executeWithLatestWins(refs, { id: 'b', value: 2 }, executeFn);

    // Complete 'a' - drain starts sending 'b'
    calls[0].resolve();
    await waitForCall(calls, 1);

    expect(executeFn).toHaveBeenCalledTimes(2);

    // Now 'b' is in-flight via the drain loop. Queue 'c'.
    executeWithLatestWins(refs, { id: 'c', value: 3 }, executeFn);
    expect(refs.pendingRef.current).toEqual({ id: 'c', value: 3 });

    // Complete 'b' - drain should pick up 'c'
    calls[1].resolve();
    await waitForCall(calls, 2);

    expect(executeFn).toHaveBeenCalledTimes(3);
    expect(calls[2].args).toEqual({ id: 'c', value: 3 });

    calls[2].resolve();
    await promise1;

    expect(refs.inFlightRef.current).toBe(false);
  });
});

describe('createLatestWinsMutationRefs', () => {
  it('creates refs with correct initial state', () => {
    const refs = createLatestWinsMutationRefs<TestArgs>();
    expect(refs.inFlightRef.current).toBe(false);
    expect(refs.pendingRef.current).toBeNull();
  });
});
