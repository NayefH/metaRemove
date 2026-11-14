import { copyFile, mkdir } from 'node:fs/promises'
const output = new URL('../public/ffmpeg/', import.meta.url)
await mkdir(output, { recursive: true })
for (const name of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
  await copyFile(new URL(`../node_modules/@ffmpeg/core/dist/esm/${name}`, import.meta.url), new URL(name, output))
}
console.log('Local FFmpeg assets ready.')
