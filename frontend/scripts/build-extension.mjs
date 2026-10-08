/**
 * Builds the FormPilot browser extension into extension/dist (load it as an unpacked extension).
 *   npm run build:extension
 * Each entry is bundled on its own: content scripts can't load modules, so everything they need is
 * inlined into one file.
 */
import { cp, mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../extension')
const out = resolve(root, 'dist')

const entries = [
  { entry: 'src/content/index.ts', file: 'content.js', format: 'iife', name: 'FormPilotContent' },
  { entry: 'src/background/service-worker.ts', file: 'service-worker.js', format: 'es' },
  { entry: 'src/popup/popup.ts', file: 'popup.js', format: 'iife', name: 'FormPilotPopup' },
]

await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })

for (const { entry, file, format, name } of entries) {
  await build({
    configFile: false,
    root,
    logLevel: 'warn',
    build: {
      outDir: out,
      emptyOutDir: false,
      target: 'chrome111',
      minify: false,
      sourcemap: false,
      copyPublicDir: false,
      lib: { entry: resolve(root, entry), formats: [format], name, fileName: () => file },
    },
  })
}

await cp(resolve(root, 'src/manifest.json'), resolve(out, 'manifest.json'))
await cp(resolve(root, 'src/popup/popup.html'), resolve(out, 'popup.html'))
await cp(resolve(root, 'icons'), resolve(out, 'icons'), { recursive: true })
console.log(`FormPilot extension built: ${out}`)
