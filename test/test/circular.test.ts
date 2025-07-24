import { resolve } from 'pathe'
import { expect, it } from 'vitest'
import { runViteNodeCli } from '../test-utils'

it('circular 1', async () => {
  const entryPath = resolve(import.meta.dirname, '../src/circular1/index.ts')
  const cli = await runViteNodeCli(entryPath)
  expect(cli.stdout).toContain('A Bindex index')
}, 60_000)

it('circular 2', async () => {
  const entryPath = resolve(import.meta.dirname, '../src/circular2/index.ts')
  const cli = await runViteNodeCli(entryPath)
  expect(cli.stdout).toContain('ac b')
}, 60_000)
