import type { TransformResult } from 'vite'
import type { DebuggerOptions } from './types'
/* eslint-disable no-console */
import { existsSync, promises as fs } from 'node:fs'
import { join, resolve } from 'pathe'
import c from 'tinyrainbow'

function hashCode(s: string) {
  return s.split('').reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0)
    return a & a
  }, 0)
}

// Keep dumped filenames comfortably under the filesystem's 255-byte limit
// (e.g. ENAMETOOLONG on POSIX) while keeping the deterministic hash suffix so
// distinct ids that truncate to the same prefix still map to different files.
const MAX_DUMP_FILE_NAME_LENGTH = 200

export class Debugger {
  dumpDir: string | undefined
  initPromise: Promise<void> | undefined
  externalizeMap: Map<string, string> = new Map()

  constructor(root: string, public options: DebuggerOptions) {
    if (options.dumpModules) {
      this.dumpDir = resolve(
        root,
        options.dumpModules === true ? '.vite-node/dump' : options.dumpModules,
      )
    }
    if (this.dumpDir) {
      if (options.loadDumppedModules) {
        console.info(
          c.gray(`[vite-node] [debug] load modules from ${this.dumpDir}`),
        )
      }
      else {
        console.info(
          c.gray(`[vite-node] [debug] dump modules to ${this.dumpDir}`),
        )
      }
    }
    this.initPromise = this.clearDump()
  }

  async clearDump(): Promise<void> {
    if (!this.dumpDir) {
      return
    }
    if (!this.options.loadDumppedModules && existsSync(this.dumpDir)) {
      await fs.rm(this.dumpDir, { recursive: true, force: true })
    }
    await fs.mkdir(this.dumpDir, { recursive: true })
  }

  encodeId(id: string): string {
    const sanitized = id.replace(/[^\w@\-]/g, '_').replace(/_+/g, '_')
    const hash = hashCode(id)
    const name = `${sanitized}-${hash}.js`
    if (name.length <= MAX_DUMP_FILE_NAME_LENGTH) {
      return name
    }
    // Reserve room for `-${hash}.js` and truncate the readable prefix so the
    // full filename stays within the limit. `-` is ASCII, so bytes === chars.
    const maxSanitizedLength = MAX_DUMP_FILE_NAME_LENGTH - name.length + sanitized.length
    return `${sanitized.slice(0, maxSanitizedLength)}-${hash}.js`
  }

  async recordExternalize(id: string, path: string): Promise<void> {
    if (!this.dumpDir) {
      return
    }
    this.externalizeMap.set(id, path)
    await this.writeInfo()
  }

  async dumpFile(id: string, result: TransformResult | null): Promise<void> {
    if (!result || !this.dumpDir) {
      return
    }
    await this.initPromise
    const name = this.encodeId(id)
    return await fs.writeFile(
      join(this.dumpDir, name),
      `// ${id.replace(/\0/g, '\\0')}\n${result.code}`,
      'utf-8',
    )
  }

  async loadDump(id: string): Promise<TransformResult | null> {
    if (!this.dumpDir) {
      return null
    }
    await this.initPromise
    const name = this.encodeId(id)
    const path = join(this.dumpDir, name)
    if (!existsSync(path)) {
      return null
    }
    const code = await fs.readFile(path, 'utf-8')
    return {
      code: code.replace(/^\/\/.*\n/, ''),
      map: undefined!,
    }
  }

  async writeInfo(): Promise<void> {
    if (!this.dumpDir) {
      return
    }
    const info = JSON.stringify(
      {
        time: new Date().toLocaleString(),
        externalize: Object.fromEntries(this.externalizeMap.entries()),
      },
      null,
      2,
    )
    return fs.writeFile(join(this.dumpDir, 'info.json'), info, 'utf-8')
  }
}
