import { resolve } from 'pathe'
import { describe, expect, it } from 'vitest'
import { runViteNodeCli } from '../test-utils'

const entryPath = resolve(import.meta.dirname, '../src/event-loop-order.ts')

describe('event loop ordering', () => {
  // The module in `src/event-loop-order.ts` schedules:
  //   Synchronous code (S), process.nextTick (N), Promise (P),
  //   queueMicrotask (Q), setImmediate (I), setTimeout (T).
  //
  // Node.js guarantees that `process.nextTick` callbacks run before the
  // microtask queue (Promises / queueMicrotask). The deterministic part of
  // that contract is confirmed here: "N" must appear before both "P" and "Q".
  // The tail ordering of the timer phase ("T") vs the check phase ("I") is not
  // guaranteed by the event loop and is flaky under load, so it is not asserted.
  it('runs process.nextTick before microtasks', async () => {
    const cli = await runViteNodeCli(entryPath)
    const out = cli.stdout.trim()

    expect(out.startsWith('SNPQ')).toBe(true)
    expect(out.indexOf('N')).toBeLessThan(out.indexOf('P'))
    expect(out.indexOf('N')).toBeLessThan(out.indexOf('Q'))
  })
})
