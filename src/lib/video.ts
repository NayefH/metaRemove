import { FFmpeg } from '@ffmpeg/ffmpeg'

export interface ProbeStream {
  index: number; codec_type: string; codec_name?: string; width?: number; height?: number
  tags?: Record<string, string>; side_data_list?: { rotation?: number }[]
}
export interface Probe {
  format?: { duration?: string; bit_rate?: string; tags?: Record<string, string> }
  streams?: ProbeStream[]
}
let engine: FFmpeg | undefined
let loading: Promise<FFmpeg> | undefined
let queue: Promise<unknown> = Promise.resolve()
export function serialVideo<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task)
  queue = result.catch(() => undefined)
  return result
}
async function getEngine(status: (message: string) => void) {
  if (engine?.loaded) return engine
  if (loading) return loading
  status('Videomodul wird geladen (ca. 32 MB) …')
  const current = new FFmpeg()
  const base = new URL(`${import.meta.env.BASE_URL}ffmpeg/`, location.href).href
  let timer:ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_,reject) => { timer = setTimeout(() => reject(new Error('Das Videomodul konnte nicht geladen werden. Bitte prüfe deine Verbindung und versuche es erneut.')),60000) })
  loading = Promise.race([current.load({ coreURL: `${base}ffmpeg-core.js`, wasmURL: `${base}ffmpeg-core.wasm` }),timeout]).then(() => {
    engine = current
    return current
  }).catch((error) => { current.terminate(); throw error }).finally(() => { clearTimeout(timer); loading = undefined })
  return loading
}
export async function probeFile(ffmpeg: FFmpeg, input: string): Promise<Probe> {
  const name = `${input}.json`
  try {
    const code = await ffmpeg.ffprobe(['-v','error','-show_format','-show_streams','-of','json',input,'-o',name], 60000)
    // core 0.12.10 leaves ret=-1 after a successful ffprobe (#817 upstream).
    // Validate the actual JSON output instead of treating that sentinel as failure.
    if (code !== 0 && code !== -1) throw new Error('Das Video konnte nicht gelesen werden.')
    const result = JSON.parse(await ffmpeg.readFile(name, 'utf8') as string) as Probe
    if (!result.format || !result.streams?.some(s => s.codec_type === 'video')) throw new Error('Die Datei enthält keine lesbare Videospur.')
    return result
  } finally { await ffmpeg.deleteFile(name).catch(() => undefined) }
}
export async function inspectVideo(file: File, status: (message: string) => void): Promise<Probe> {
  return serialVideo(async () => {
    const ffmpeg = await getEngine(status)
    const input = `inspect.${file.name.split('.').pop()?.toLowerCase()}`
    status('Video-Metadaten werden gelesen …')
    try {
      await ffmpeg.writeFile(input, new Uint8Array(await file.arrayBuffer()))
      return await probeFile(ffmpeg, input)
    } finally { await ffmpeg.deleteFile(input).catch(() => undefined) }
  })
}
export async function cleanVideo(file: File, status: (message: string) => void) {
  return serialVideo(async () => {
    const ffmpeg = await getEngine(status)
    const ext = file.name.split('.').pop()!.toLowerCase()
    const input = `input.${ext}`
    const output = `clean.${ext}`
    status('Video wird ohne Neukodierung bereinigt …')
    try {
      await ffmpeg.writeFile(input, new Uint8Array(await file.arrayBuffer()))
      const args = ['-i',input,'-map','0:v','-map','0:a?','-c','copy','-map_metadata','-1','-map_metadata:s','-1','-map_chapters','-1','-metadata','encoder=','-metadata:s','encoder=','-fflags','+bitexact']
      if (ext === 'mp4' || ext === 'mov') args.push('-movflags','+faststart')
      args.push(output)
      const code = await ffmpeg.exec(args, 180000)
      if (code !== 0) throw new Error('Dieses Video lässt sich nicht verlustfrei bereinigen. Bitte verwende eine andere Datei oder einen anderen Container.')
      status('Bereinigte Video-Metadaten werden geprüft …')
      const probe = await probeFile(ffmpeg, output)
      const data = await ffmpeg.readFile(output)
      if (typeof data === 'string') throw new Error('Ungültige Videoausgabe.')
      return { blob: new Blob([new Uint8Array(data).buffer], { type: ext === 'mov' ? 'video/quicktime' : ext === 'mkv' ? 'video/x-matroska' : `video/${ext}` }), probe }
    } finally {
      await ffmpeg.deleteFile(input).catch(() => undefined)
      await ffmpeg.deleteFile(output).catch(() => undefined)
    }
  })
}
