/**
 * Builds the FormPilot browser extension into extension/dist (load it as an unpacked extension), and
 * zips it into frontend/public/formpilot-extension.zip so the website can offer it as a download.
 *   npm run build:extension
 * Each entry is bundled on its own: content scripts can't load modules, so everything they need is
 * inlined into one file.
 */
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateRawSync } from 'node:zlib'
import { build } from 'vite'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../extension')
const out = resolve(root, 'dist')
const zipPath = resolve(here, '../public/formpilot-extension.zip')

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

// --- Zip for download (Chrome Web Store uploads take the same file) -------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

async function listFiles(dir) {
  const files = []
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, item.name)
    if (item.isDirectory()) files.push(...(await listFiles(path)))
    else files.push(path)
  }
  return files.sort()
}

/** A standard ZIP (deflate) of every file under `dir`, with paths relative to it. */
async function zip(dir) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const file of await listFiles(dir)) {
    const name = Buffer.from(relative(dir, file).split(sep).join('/'))
    const data = await readFile(file)
    const packed = deflateRawSync(data, { level: 9 })
    const crc = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(0x0800, 6) // UTF-8 names
    local.writeUInt16LE(8, 8) // deflate
    local.writeUInt32LE(0, 10) // time/date
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(packed.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    locals.push(local, name, packed)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4) // version made by
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(8, 10)
    central.writeUInt32LE(0, 12)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(packed.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(offset, 42)
    centrals.push(central, name)
    offset += local.length + name.length + packed.length
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(centrals.length / 2, 8)
  end.writeUInt16LE(centrals.length / 2, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, ...centrals, end])
}

await mkdir(dirname(zipPath), { recursive: true })
await writeFile(zipPath, await zip(out))
console.log(`FormPilot extension built: ${out}`)
console.log(`Download zip: ${zipPath}`)
