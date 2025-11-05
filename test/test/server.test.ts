import type { Plugin, ViteDevServer } from 'vite'
import { join, resolve } from 'pathe'
import { createServer } from 'vite'
import { ViteNodeServer } from 'vite-node/server'
import { it as baseTest, describe, expect, it, vi } from 'vitest'
import { extractSourceMap } from '../../src/source-map'

describe('server works correctly', async () => {
  it('resolve id considers transform mode', async () => {
    const resolveId = vi.fn()

    const vnServer = new ViteNodeServer({
      pluginContainer: { resolveId },
      config: {
        root: '/',
      },
      moduleGraph: {
        idToModuleMap: new Map(),
      },
    } as any, {
      transformMode: {
        web: [/web/],
        ssr: [/ssr/],
      },
    })

    await vnServer.resolveId('/path', '/web path')
    expect(resolveId).toHaveBeenCalledWith('/path', '/web path', { ssr: false })

    await vnServer.resolveId('/ssr', '/ssr path')
    expect(resolveId).toHaveBeenCalledWith('/ssr', '/ssr path', { ssr: true })
  })
})

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('server correctly caches data', () => {
  const it = baseTest.extend<{
    root: string
    plugin: Plugin
    ssrFiles: string[]
    webFiles: string[]
    server: ViteDevServer
    viteNode: ViteNodeServer
  }>({
    ssrFiles: async ({}, use) => {
      await use([])
    },
    webFiles: async ({}, use) => {
      await use([])
    },
    root: resolve(import.meta.dirname, '../'),
    plugin: async ({ ssrFiles, webFiles }, use) => {
      const plugin: Plugin = {
        name: 'test',
        transform(code, id, options) {
          // this should be called only once if cached is configured correctly
          if (options?.ssr) {
            ssrFiles.push(id)
          }
          else {
            webFiles.push(id)
          }
        },
      }
      await use(plugin)
    },
    server: async ({ root, plugin }, use) => {
      const server = await createServer({
        configFile: false,
        root,
        server: {
          middlewareMode: true,
          watch: null,
        },
        plugins: [plugin],
      })
      await use(server)
      await server.close()
    },
    viteNode: async ({ server }, use) => {
      const vnServer = new ViteNodeServer(server)
      await use(vnServer)
    },
  })

  it('fetchModule with id, and got sourcemap source in absolute path', async ({ viteNode }) => {
    const fetchResult = await viteNode.fetchModule('/src/foo.js')

    const sourceMap = extractSourceMap(fetchResult.code!)

    // expect got sourcemap source in a valid filesystem path
    expect(sourceMap?.sources[0]).toBe('foo.js')
  })

  it('correctly returns cached and invalidated ssr modules', async ({ root, viteNode, ssrFiles, webFiles, server }) => {
    await viteNode.fetchModule('/src/foo.js', 'ssr')

    const fsPath = join(root, './src/foo.js')

    expect(viteNode.fetchCaches.web.has(fsPath)).toBe(false)
    expect(viteNode.fetchCache.has(fsPath)).toBe(true)
    expect(viteNode.fetchCaches.ssr.has(fsPath)).toBe(true)

    expect(webFiles).toHaveLength(0)
    expect(ssrFiles).toHaveLength(1)
    expect(ssrFiles).toContain(fsPath)

    await viteNode.fetchModule('/src/foo.js', 'ssr')

    expect(ssrFiles).toHaveLength(1)

    server.moduleGraph.invalidateModule(
      server.moduleGraph.getModuleById(fsPath)!,
      new Set(),
      Date.now(),
      false,
    )

    // wait so TS are different
    await wait(100)

    await viteNode.fetchModule('/src/foo.js', 'ssr')

    expect(ssrFiles).toHaveLength(2)

    // another fetch after invalidation returns cached result
    await viteNode.fetchModule('/src/foo.js', 'ssr')

    expect(ssrFiles).toHaveLength(2)

    server.moduleGraph.invalidateModule(
      server.moduleGraph.getModuleById(fsPath)!,
      new Set(),
      Date.now(),
      true,
    )

    // wait so TS are different
    await wait(100)

    await viteNode.fetchModule('/src/foo.js', 'ssr')

    await expect.poll(() => ssrFiles).toHaveLength(3)

    // another fetch after invalidation returns cached result
    await viteNode.fetchModule('/src/foo.js', 'ssr')

    await expect.poll(() => ssrFiles).toHaveLength(3)
    expect(webFiles).toHaveLength(0)
  })

  it('correctly returns cached and invalidated web modules', async ({ root, viteNode, webFiles, ssrFiles, server }) => {
    await viteNode.fetchModule('/src/foo.js', 'web')

    const fsPath = join(root, './src/foo.js')

    expect(viteNode.fetchCaches.ssr.has(fsPath)).toBe(false)
    expect(viteNode.fetchCache.has(fsPath)).toBe(true)
    expect(viteNode.fetchCaches.web.has(fsPath)).toBe(true)

    expect(ssrFiles).toHaveLength(0)
    expect(webFiles).toHaveLength(1)
    expect(webFiles).toContain(fsPath)

    await viteNode.fetchModule('/src/foo.js', 'web')

    expect(webFiles).toHaveLength(1)

    server.moduleGraph.invalidateModule(
      server.moduleGraph.getModuleById(fsPath)!,
      new Set(),
      Date.now(),
      false,
    )

    // wait so TS are different
    await wait(100)

    await viteNode.fetchModule('/src/foo.js', 'web')

    expect(webFiles).toHaveLength(2)

    // another fetch after invalidation returns cached result
    await viteNode.fetchModule('/src/foo.js', 'web')

    expect(webFiles).toHaveLength(2)

    server.moduleGraph.invalidateModule(
      server.moduleGraph.getModuleById(fsPath)!,
      new Set(),
      Date.now(),
      true,
    )

    // wait so TS are different
    await wait(100)

    await viteNode.fetchModule('/src/foo.js', 'web')

    await expect.poll(() => webFiles).toHaveLength(3)

    // another fetch after invalidation returns cached result
    await viteNode.fetchModule('/src/foo.js', 'web')

    await expect.poll(() => webFiles).toHaveLength(3)
    await expect.poll(() => ssrFiles).toHaveLength(0)
  })

  it('correctly processes the same file with both transform modes', async ({ viteNode, ssrFiles, webFiles, root }) => {
    await viteNode.fetchModule('/src/foo.js', 'ssr')
    await viteNode.fetchModule('/src/foo.js', 'web')

    const fsPath = join(root, './src/foo.js')

    expect(viteNode.fetchCaches.ssr.has(fsPath)).toBe(true)
    expect(viteNode.fetchCache.has(fsPath)).toBe(true)
    expect(viteNode.fetchCaches.web.has(fsPath)).toBe(true)

    expect(ssrFiles).toHaveLength(1)
    expect(webFiles).toHaveLength(1)

    await viteNode.fetchModule('/src/foo.js', 'ssr')
    await viteNode.fetchModule('/src/foo.js', 'web')

    expect(ssrFiles).toHaveLength(1)
    expect(webFiles).toHaveLength(1)
  })
})

describe('externalize', () => {
  describe('by default', () => {
    it('should externalize vite\'s cached dependencies', async () => {
      const vnServer = new ViteNodeServer({
        config: {
          root: '/',
          cacheDir: '/node_modules/.vite',
        },
      } as any, {})

      const externalize = await vnServer.shouldExternalize('/node_modules/.vite/cached.js')
      expect(externalize).toBeTruthy()
    })
  })

  describe('with server.deps.inline: true', () => {
    it('should not externalize vite\'s cached dependencies', async () => {
      const vnServer = new ViteNodeServer({
        config: {
          root: '/',
          cacheDir: '/node_modules/.vite',
        },
      } as any, {
        deps: {
          inline: true,
        },
      })

      const externalize = await vnServer.shouldExternalize('/node_modules/.vite/cached.js')
      expect(externalize).toBeFalsy()
    })
  })

  describe('with server.deps.inline including the cache dir', () => {
    it('should not externalize vite\'s cached dependencies', async () => {
      const vnServer = new ViteNodeServer({
        config: {
          root: '/',
          cacheDir: '/node_modules/.vite',
        },
      } as any, {
        deps: {
          inline: [/node_modules\/\.vite/],
        },
      })

      const externalize = await vnServer.shouldExternalize('/node_modules/.vite/cached.js')
      expect(externalize).toBeFalsy()
    })
  })
})
