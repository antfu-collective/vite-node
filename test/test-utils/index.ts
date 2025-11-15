import type { Options } from 'tinyexec'
import fs from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'pathe'
import { x } from 'tinyexec'
import { afterEach, onTestFinished } from 'vitest'
import { getCurrentTest } from 'vitest/suite'
import { Cli } from './cli'

interface CliOptions extends Partial<Options> {
  earlyReturn?: boolean
  preserveAnsi?: boolean
}

async function runCli(command: string, _options?: CliOptions | string, ...args: string[]) {
  let options = _options

  if (typeof _options === 'string') {
    args.unshift(_options)
    options = undefined
  }

  const signal = getCurrentTest()?.context.signal
  const subprocess = x(command, args, { ...options as Options, signal }).process!
  const cli = new Cli({
    stdin: subprocess.stdin!,
    stdout: subprocess.stdout!,
    stderr: subprocess.stderr!,
    preserveAnsi: typeof _options !== 'string' ? _options?.preserveAnsi : false,
  })

  let setDone: (value?: unknown) => void
  const isDone = new Promise(resolve => (setDone = resolve))
  subprocess.on('exit', () => setDone())

  function output() {
    return {
      vitest: cli,
      exitCode: subprocess.exitCode,
      stdout: cli.stdout || '',
      stderr: cli.stderr || '',
      waitForClose: () => isDone,
    }
  }

  // Manually stop the processes so that each test don't have to do this themselves
  onTestFinished(async () => {
    if (subprocess.exitCode === null) {
      subprocess.kill()
    }

    await isDone
  })

  if ((options as CliOptions)?.earlyReturn || args.includes('--inspect') || args.includes('--inspect-brk')) {
    return output()
  }

  if (args[0] === 'init') {
    return output()
  }

  if (args[0] !== 'list' && (args.includes('--watch') || args[0] === 'watch')) {
    // make sure watcher is ready
    await cli.waitForStdout('[debug] watcher is ready')
    cli.stdout = cli.stdout.replace('[debug] watcher is ready\n', '')
  }
  else {
    await isDone
  }

  return output()
}

export async function runViteNodeCli(_options?: CliOptions | string, ...args: string[]) {
  process.env.VITE_TEST_WATCHER_DEBUG = 'true'
  const { vitest, ...rest } = await runCli(resolve(import.meta.dirname, '../../dist/cli.mjs'), _options, ...args)

  return { viteNode: vitest, ...rest }
}

const originalFiles = new Map<string, string>()
const createdFiles = new Set<string>()
afterEach(() => {
  originalFiles.forEach((content, file) => {
    fs.writeFileSync(file, content, 'utf-8')
  })
  createdFiles.forEach((file) => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file)
    }
  })
  originalFiles.clear()
  createdFiles.clear()
})

export function createFile(file: string, content: string) {
  createdFiles.add(file)
  fs.mkdirSync(dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf-8')
}

export function editFile(file: string, callback: (content: string) => string) {
  const content = fs.readFileSync(file, 'utf-8')
  if (!originalFiles.has(file)) {
    originalFiles.set(file, content)
  }
  fs.writeFileSync(file, callback(content), 'utf-8')
}

export function resolvePath(baseUrl: string, path: string) {
  const filename = fileURLToPath(baseUrl)
  return resolve(dirname(filename), path)
}
