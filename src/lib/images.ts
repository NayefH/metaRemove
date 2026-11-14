// Container-level editing keeps compressed pixels, animations and colour profiles intact.
export type ImageKind = 'jpeg' | 'png' | 'webp'
const ascii = (bytes: Uint8Array, start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length))
const concat = (parts: Uint8Array[]) => {
  const output = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const part of parts) { output.set(part, offset); offset += part.length }
  return output
}
export function imageKind(bytes: Uint8Array): ImageKind | undefined {
  if (bytes[0] === 255 && bytes[1] === 216) return 'jpeg'
  if (bytes.length >= 8 && bytes.subarray(0, 8).every((n, i) => n === [137,80,78,71,13,10,26,10][i])) return 'png'
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'webp'
}
function orientationTiff(value: number) {
  return new Uint8Array([73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,value,0,0,0,0,0,0,0])
}
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const b of bytes) {
    crc ^= b
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}
function pngChunk(type: string, payload: Uint8Array) {
  const output = new Uint8Array(payload.length + 12)
  const view = new DataView(output.buffer)
  view.setUint32(0, payload.length)
  output.set(new TextEncoder().encode(type), 4)
  output.set(payload, 8)
  view.setUint32(output.length - 4, crc32(output.subarray(4, output.length - 4)))
  return output
}
function webpChunk(type: string, payload: Uint8Array) {
  const output = new Uint8Array(8 + payload.length + (payload.length % 2))
  output.set(new TextEncoder().encode(type))
  new DataView(output.buffer).setUint32(4, payload.length, true)
  output.set(payload, 8)
  return output
}
export function stripImage(bytes: Uint8Array, orientation = 1): { bytes: Uint8Array; removed: string[]; kind: ImageKind } {
  const kind = imageKind(bytes)
  const removed: string[] = []
  const parts: Uint8Array[] = []
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const keepOrientation = Number.isInteger(orientation) && orientation >= 2 && orientation <= 8
  const invalid = () => { throw new Error('Die Datei ist beschädigt oder unvollständig. Bitte wähle eine andere Datei.') }
  if (kind === 'jpeg') {
    parts.push(bytes.subarray(0, 2))
    if (keepOrientation) {
      const tiff = orientationTiff(orientation)
      parts.push(concat([new Uint8Array([255,225,0,tiff.length + 8,69,120,105,102,0,0]), tiff]))
    }
    let offset = 2
    let hasScan = false
    while (offset < bytes.length) {
      const start = offset
      if (bytes[offset++] !== 255) return invalid()
      while (bytes[offset] === 255) offset++
      const marker = bytes[offset++]
      if (marker === 217) {
        if (!hasScan) return invalid()
        parts.push(bytes.subarray(start, offset))
        if (offset < bytes.length) removed.push('Angehängte Daten')
        return { bytes: concat(parts), removed, kind }
      }
      if (marker === 216 || marker === 0 || marker === undefined) return invalid()
      if (marker === 1 || (marker >= 208 && marker <= 215)) { parts.push(bytes.subarray(start, offset)); continue }
      if (offset + 2 > bytes.length) return invalid()
      const length = view.getUint16(offset)
      if (length < 2 || offset + length > bytes.length) return invalid()
      const end = offset + length
      const isApp = marker >= 224 && marker <= 239
      const colour = (marker === 226 && ascii(bytes, offset + 2, 12) === 'ICC_PROFILE\0') || (marker === 238 && ascii(bytes, offset + 2, 5) === 'Adobe')
      if ((isApp && !colour) || marker === 254) {
        removed.push(marker === 225 ? 'EXIF / XMP' : marker === 237 ? 'IPTC' : marker === 254 ? 'Kommentar' : `APP${marker - 224}`)
      } else parts.push(bytes.subarray(start, end))
      offset = end
      if (marker === 218) {
        hasScan = true
        const scanStart = offset
        while (offset < bytes.length) {
          if (bytes[offset] !== 255) { offset++; continue }
          let next = offset + 1
          while (bytes[next] === 255) next++
          if (bytes[next] === 0 || (bytes[next] >= 208 && bytes[next] <= 215)) { offset = next + 1; continue }
          break
        }
        parts.push(bytes.subarray(scanStart, offset))
      }
    }
    return invalid()
  }
  if (kind === 'png') {
    parts.push(bytes.subarray(0, 8))
    const keep = new Set(['IHDR','PLTE','IDAT','IEND','tRNS','cHRM','gAMA','sRGB','iCCP','bKGD','sBIT','acTL','fcTL','fdAT','cICP','mDCV','cLLI'])
    let offset = 8
    let hasData = false
    while (offset + 12 <= bytes.length) {
      const length = view.getUint32(offset)
      const end = offset + length + 12
      if (end > bytes.length) return invalid()
      const type = ascii(bytes, offset + 4, 4)
      if (offset === 8 && (type !== 'IHDR' || length !== 13)) return invalid()
      if (crc32(bytes.subarray(offset + 4, end - 4)) !== view.getUint32(end - 4)) return invalid()
      if (type === 'IDAT') hasData = true
      if (type === 'IEND') {
        if (!hasData || length !== 0) return invalid()
        parts.push(bytes.subarray(offset, end))
        if (end < bytes.length) removed.push('Angehängte Daten')
        return { bytes: concat(parts), removed, kind }
      }
      if (keep.has(type)) parts.push(bytes.subarray(offset, end))
      else {
        if (type[0] === type[0].toUpperCase()) return invalid()
        removed.push(type)
      }
      if (type === 'IHDR' && keepOrientation) parts.push(pngChunk('eXIf', orientationTiff(orientation)))
      offset = end
    }
    return invalid()
  }
  if (kind === 'webp') {
    if (bytes.length < 20) return invalid()
    const limit = view.getUint32(4, true) + 8
    if (limit > bytes.length || limit < 20) return invalid()
    let offset = 12
    let hasPixels = false
    let extended = false
    const keep = new Set(['VP8X','VP8 ','VP8L','ALPH','ANIM','ANMF','ICCP'])
    while (offset + 8 <= limit) {
      const type = ascii(bytes, offset, 4)
      const length = view.getUint32(offset + 4, true)
      const end = offset + 8 + length + (length % 2)
      if (end > limit) return invalid()
      if (['VP8 ','VP8L','ANMF'].includes(type)) hasPixels = true
      if (type === 'VP8X') {
        if (length !== 10) return invalid()
        extended = true
        const chunk = bytes.slice(offset, end)
        chunk[8] = (chunk[8] & ~12) | (keepOrientation ? 8 : 0)
        parts.push(chunk)
      } else if (keep.has(type)) parts.push(bytes.subarray(offset, end))
      else removed.push(type.trim())
      offset = end
    }
    if (offset !== limit || !hasPixels || (keepOrientation && !extended)) return invalid()
    if (keepOrientation) parts.push(webpChunk('EXIF', orientationTiff(orientation)))
    if (limit < bytes.length) removed.push('Angehängte Daten')
    const header = bytes.slice(0, 12)
    new DataView(header.buffer).setUint32(4, parts.reduce((n, p) => n + p.length, 4), true)
    return { bytes: concat([header, ...parts]), removed, kind }
  }
  throw new Error('Unterstützt werden JPG, PNG und WebP sowie MP4, MOV, WebM und MKV.')
}
