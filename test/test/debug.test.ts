import { Buffer } from 'node:buffer'
import { mkdtemp } from 'node:fs/promises'
import { join } from 'pathe'
import { describe, expect, it } from 'vitest'
import { Debugger } from '../../src/debug'

const MAX_DUMP_FILE_NAME_LENGTH = 200

function veryLongId(): string {
  // A long absolute path ending in a long spec filename, mirroring the
  // ENAMETOOLONG scenario from vitest-dev/vitest#7744.
  return `/Volumes/External/Long/Module/Path/${'a'.repeat(400)}_very_long_spec_tsx`
}

function debuggerWithDump(dir: string): Debugger {
  return new Debugger('', { dumpModules: dir })
}

describe('debugger encodeId', () => {
  it('caps the encoded filename length for very long ids', () => {
    const debugger_ = new Debugger('', {})
    const name = debugger_.encodeId(veryLongId())

    // Filesystem limits are byte-based; ensure we stay comfortably under 255.
    expect(Buffer.byteLength(name)).toBeLessThanOrEqual(MAX_DUMP_FILE_NAME_LENGTH)
    expect(Buffer.byteLength(name)).toBeLessThan(255)
    expect(name.endsWith('.js')).toBe(true)
  })

  it('round-trips dumpFile/loadDump with a very long id', async () => {
    const dir = await mkdtemp(join('/tmp/opencode', 'vite-node-dump-'))
    const debugger_ = debuggerWithDump(dir)
    const id = veryLongId()
    const code = 'console.log("dumped")'

    await expect(debugger_.dumpFile(id, { code, map: null })).resolves.toBeUndefined()

    const loaded = await debugger_.loadDump(id)
    expect(loaded?.code).toBe(code)
  })

  it('keeps unique filenames for distinct long ids sharing a long common prefix', () => {
    const debugger_ = new Debugger('', {})
    const commonPrefix = `/Volumes/very/long/shared/prefix/${'x'.repeat(400)}`

    const nameA = debugger_.encodeId(`${commonPrefix}module_a.ts`)
    const nameB = debugger_.encodeId(`${commonPrefix}module_b.ts`)

    expect(nameA).not.toBe(nameB)
    expect(Buffer.byteLength(nameA)).toBeLessThanOrEqual(MAX_DUMP_FILE_NAME_LENGTH)
    expect(Buffer.byteLength(nameB)).toBeLessThanOrEqual(MAX_DUMP_FILE_NAME_LENGTH)
  })

  it('encodes short ids exactly as before', () => {
    const debugger_ = new Debugger('', {})
    // Hardcoded outputs produced by the pre-fix encodeId formula.
    expect(debugger_.encodeId('src/utils/foo.ts')).toBe('src_utils_foo_ts-1252568592.js')
    expect(debugger_.encodeId('src/foo/bar.ts')).toBe('src_foo_bar_ts-155658414.js')
    expect(debugger_.encodeId('test/fixtures/basic.ts')).toBe('test_fixtures_basic_ts-518376679.js')
  })
})
