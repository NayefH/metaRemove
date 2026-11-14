import * as exifr from 'exifr'
import { imageKind, stripImage } from './images'
import { inspectVideo, cleanVideo } from './video'
import type { Probe } from './video'

export interface Metadata { label: string; value: string; personal: boolean }
export interface MediaInfo { metadata: Metadata[]; blocks: string[]; orientation: number; width?: number; height?: number; duration?: number }
export const MAX_FILE_SIZE = 250 * 1024 * 1024
const technical = /^(ImageWidth|ImageHeight|ExifImageWidth|ExifImageHeight|Orientation|ColorSpace|XResolution|YResolution|ResolutionUnit|YCbCrPositioning|ComponentsConfiguration|ExifVersion|FlashpixVersion|BitsPerSample|BitDepth|ColorType|Filter|Interlace|Compression|PhotometricInterpretation|SamplesPerPixel|Profile.*|CMMType|DeviceManufacturer|DeviceModel|PrimaryPlatform|RenderingIntent|ConnectionSpaceIlluminant|major_brand|minor_version|compatible_brands|encoder|handler_name|vendor_id|language|DURATION|NUMBER_OF_FRAMES|NUMBER_OF_BYTES|_STATISTICS_.*|BPS)$/i
const labels: Record<string,string> = { Make:'Hersteller', Model:'Kameramodell', Software:'Software', DateTimeOriginal:'Aufgenommen am', CreateDate:'Erstellt am', ModifyDate:'Geändert am', GPSLatitude:'GPS-Breitengrad', GPSLongitude:'GPS-Längengrad', latitude:'Breitengrad', longitude:'Längengrad', GPSAltitude:'Höhe', Artist:'Urheber', Copyright:'Copyright', LensModel:'Objektiv', ISO:'ISO', FNumber:'Blende', ExposureTime:'Belichtungszeit', FocalLength:'Brennweite', ImageWidth:'Breite', ImageHeight:'Höhe', ExifImageWidth:'Bildbreite', ExifImageHeight:'Bildhöhe', Orientation:'Ausrichtung', ColorSpace:'Farbraum', ImageDescription:'Beschreibung', UserComment:'Kommentar', BodySerialNumber:'Kamera-Seriennummer', LensSerialNumber:'Objektiv-Seriennummer', creation_time:'Aufnahmezeit', location:'Standort', title:'Titel', artist:'Urheber', comment:'Kommentar', description:'Beschreibung', encoder:'Encoder', handler_name:'Spurbezeichnung', major_brand:'Container', compatible_brands:'Kompatible Container', minor_version:'Container-Version', language:'Sprache', vendor_id:'Herstellerkennung' }
function display(value: unknown): string {
  if (value instanceof Date) return value.toLocaleString('de-DE')
  if (value instanceof Uint8Array || value instanceof ArrayBuffer) return 'Binäre Daten'
  if (typeof value === 'object' && value !== null) return JSON.stringify(value).slice(0, 2000)
  return String(value).slice(0, 2000)
}
function tagRows(tags: Record<string,unknown>, prefix = ''): Metadata[] {
  return Object.entries(tags).filter(([,v]) => v !== undefined && v !== null).map(([key,value]) => ({ label: `${prefix}${labels[key] ?? key}`, value: display(value), personal: !technical.test(key) }))
}
export function videoInfo(probe: Probe): MediaInfo {
  const video = probe.streams?.find(s => s.codec_type === 'video')
  const metadata = tagRows(probe.format?.tags ?? {})
  for (const stream of probe.streams ?? []) {
    metadata.push(...tagRows(stream.tags ?? {}, `${stream.codec_type === 'video' ? 'Bild' : stream.codec_type === 'audio' ? 'Ton' : 'Daten'} · `))
    if (stream.codec_name) metadata.push({label:`Spur ${stream.index} · Codec`,value:stream.codec_name,personal:false})
    for (const side of stream.side_data_list ?? []) if (side.rotation) metadata.push({label:'Bildausrichtung',value:`${side.rotation}°`,personal:false})
  }
  return { metadata, blocks: [], orientation:1, width:video?.width, height:video?.height, duration:Number(probe.format?.duration) || undefined }
}
export function isVideo(file: File) { return /\.(mp4|mov|webm|mkv)$/i.test(file.name) }
export function supported(file: File) { return /\.(jpe?g|png|webp|mp4|mov|webm|mkv)$/i.test(file.name) }
export async function inspectMedia(file: File, status: (message: string) => void): Promise<MediaInfo> {
  if (isVideo(file)) return videoInfo(await inspectVideo(file, status))
  const bytes = new Uint8Array(await file.arrayBuffer())
  const kind = imageKind(bytes)
  if (!kind) throw new Error('Der Dateiinhalt ist kein unterstütztes Bild.')
  let orientation = 1
  let tags: Record<string,unknown> = {}
  if (kind === 'webp') {
    // exifr has no WebP container reader; parse its EXIF and XMP sidecars explicitly.
    const view = new DataView(bytes.buffer)
    const end = view.getUint32(4,true) + 8
    for (let offset = 12; offset + 8 <= Math.min(end,bytes.length);) {
      const type = String.fromCharCode(...bytes.subarray(offset,offset + 4))
      const length = view.getUint32(offset + 4,true)
      if (offset + 8 + length > bytes.length) throw new Error('Die WebP-Datei ist unvollständig.')
      let payload = bytes.slice(offset + 8, offset + 8 + length)
      if (type === 'EXIF') {
        if (String.fromCharCode(...payload.subarray(0,6)) === 'Exif\0\0') payload = payload.slice(6)
        orientation = await exifr.orientation(payload) ?? 1
        tags = {...tags,...await exifr.parse(payload,{xmp:true,iptc:true,userComment:true})}
      } else if (type === 'XMP ') tags = {...tags,...await exifr.sidecar(payload,{xmp:true},'xmp')}
      offset += 8 + length + length % 2
    }
  } else {
    orientation = await exifr.orientation(file) ?? 1
    tags = await exifr.parse(file, { xmp:true, iptc:true, userComment:true, makerNote:false, translateValues:true }) ?? {}
  }
  const stripped = stripImage(bytes, orientation)
  let width: number | undefined, height: number | undefined
  try {
    const bitmap = await createImageBitmap(file)
    width = bitmap.width; height = bitmap.height; bitmap.close()
  } catch { /* Container parsing still works when a browser cannot preview the codec. */ }
  return { metadata:tagRows(tags), blocks:stripped.removed, orientation, width, height }
}
export async function cleanMedia(file: File, info: MediaInfo, status: (message: string) => void) {
  if (isVideo(file)) {
    const result = await cleanVideo(file, status)
    const checked = videoInfo(result.probe)
    if (checked.metadata.some(m => m.personal)) throw new Error('Die Kontrolle hat verbliebene Video-Metadaten gefunden. Es wurde kein Download freigegeben.')
    return {blob:result.blob, info:checked}
  }
  status('Metadaten werden entfernt …')
  const result = stripImage(new Uint8Array(await file.arrayBuffer()), info.orientation)
  const blob = new Blob([result.bytes.buffer as ArrayBuffer], {type:`image/${result.kind === 'jpeg' ? 'jpeg' : result.kind}`})
  const cleaned = new File([blob], file.name, {type:blob.type})
  const checked = await inspectMedia(cleaned, status)
  if (checked.metadata.some(m => m.personal)) throw new Error('Die Kontrolle hat verbliebene Metadaten gefunden. Es wurde kein Download freigegeben.')
  return {blob, info:checked}
}
export function cleanName(name: string) { return `${name.replace(/\.[^.]+$/, '')}_bereinigt.${name.split('.').pop()?.toLowerCase()}` }
export function formatSize(bytes: number) { return bytes < 1024 * 1024 ? `${(bytes / 1024).toLocaleString('de-DE',{maximumFractionDigits:0})} KB` : `${(bytes / 1024 / 1024).toLocaleString('de-DE',{maximumFractionDigits:1})} MB` }
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a'); link.href = url; link.download = name; document.body.append(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}
