import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { unzipSync } from 'fflate'

test('responsive empty workspace, help and unsupported files',async({page})=>{
  const errors:string[]=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading',{name:'Metadaten entfernen',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Hilfe',exact:true}).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.locator('input[type=file]').setInputFiles({name:'unsupported.txt',mimeType:'text/plain',buffer:Buffer.from('hello')})
  await expect(page.getByRole('alert')).toContainText('Dateiformat nicht unterstützt')
  for(const width of [320,390,768,1024,1440]){
    await page.setViewportSize({width,height:844})
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await expect(page.getByRole('button',{name:'Dateien auswählen',exact:true})).toBeVisible()
    await expect(page.getByRole('button',{name:'Hilfe',exact:true})).toBeVisible()
  }
  await page.setViewportSize({width:390,height:844})
  await page.screenshot({path:'artifacts/mobile.png',fullPage:true})
  await page.setViewportSize({width:1440,height:1050})
  await page.getByRole('button',{name:'Hinweis schließen'}).click()
  await page.screenshot({path:'artifacts/desktop.png',fullPage:true})
  expect(errors).toEqual([])
})

test('real JPEG, PNG and WebP keep pixels and orientation, strip metadata, download individually and as ZIP',async({page})=>{
  await page.goto('/')
  const fixtures=await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=80;canvas.height=40
    const context=canvas.getContext('2d')!;context.fillStyle='#58724c';context.fillRect(0,0,80,40);context.fillStyle='#efc478';context.fillRect(0,0,32,20)
    const enc=new TextEncoder()
    const cat=(...parts:Uint8Array[])=>{const result=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const p of parts){result.set(p,offset);offset+=p.length}return result}
    const tiff=new Uint8Array(55);const tv=new DataView(tiff.buffer);tiff.set([73,73,42,0,8,0,0,0]);tv.setUint16(8,2,true);tv.setUint16(10,0x112,true);tv.setUint16(12,3,true);tv.setUint32(14,1,true);tv.setUint16(18,6,true);tv.setUint16(22,0x13b,true);tv.setUint16(24,2,true);tv.setUint32(26,17,true);tv.setUint32(30,38,true);tiff.set(enc.encode('PRIVATE_PERSON_1\0'),38)
    const app=(type:number,p:Uint8Array)=>cat(new Uint8Array([255,type,(p.length+2)>>8,(p.length+2)&255]),p)
    const webchunk=(type:string,p:Uint8Array)=>{const out=new Uint8Array(8+p.length+p.length%2);out.set(enc.encode(type));new DataView(out.buffer).setUint32(4,p.length,true);out.set(p,8);return out}
    const result=[]
    for(const format of ['jpeg','png','webp']){
      const blob=await new Promise<Blob>(r=>canvas.toBlob(b=>r(b!),`image/${format}`,.9))
      let b=new Uint8Array(await blob.arrayBuffer())
      if(format==='jpeg') b=cat(b.slice(0,2),app(225,cat(enc.encode('Exif\0\0'),tiff)),b.slice(2),enc.encode('PRIVATE_TRAILER'))
      if(format==='png'){
        const payload=enc.encode('Author\0PRIVATE_PERSON_1');const out=new Uint8Array(payload.length+12);const view=new DataView(out.buffer);view.setUint32(0,payload.length);out.set(enc.encode('tEXt'),4);out.set(payload,8);let crc=0xffffffff;for(const v of out.subarray(4,-4)){crc^=v;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}view.setUint32(out.length-4,(crc^0xffffffff)>>>0);b=cat(b.slice(0,33),out,b.slice(33))
      }
      if(format==='webp'){
        const chunks=b.slice(12);const ext=new Uint8Array(10);ext[0]=8;ext[4]=79;ext[7]=39
        const hasExtended=String.fromCharCode(...chunks.slice(0,4))==='VP8X'
        if(hasExtended)chunks[8]|=8
        b=cat(enc.encode('RIFF'),new Uint8Array(4),enc.encode('WEBP'),...(hasExtended?[]:[webchunk('VP8X',ext)]),chunks,webchunk('EXIF',tiff));new DataView(b.buffer).setUint32(4,b.length-8,true)
      }
      result.push({format,bytes:Array.from(b)})
    }
    return result
  })
  await page.locator('input[type=file]').setInputFiles(fixtures.map(f=>({name:`test.${f.format==='jpeg'?'jpg':f.format}`,mimeType:`image/${f.format}`,buffer:Buffer.from(f.bytes)})))
  await expect(page.getByText('Analysiert',{exact:true})).toHaveCount(3)
  await expect(page.getByRole('cell',{name:'PRIVATE_PERSON_1',exact:true})).toBeVisible()
  for(const width of [320,390,768,1024,1440]){
    await page.setViewportSize({width,height:844})
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    expect(await page.locator('.metadata-table').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
  }
  await page.setViewportSize({width:390,height:844})
  await page.screenshot({path:'artifacts/mobile-metadata.png',fullPage:true})
  await page.setViewportSize({width:1440,height:1050})
  await page.getByRole('button',{name:'Alle bereinigen'}).click()
  await expect(page.locator('.file-copy .status-clean')).toHaveCount(3)
  for(const f of fixtures){
    const name=`test.${f.format==='jpeg'?'jpg':f.format}`
    await page.getByRole('button',{name:new RegExp(name.replace('.','\\.'))}).first().click()
    await page.getByRole('button',{name:'Bereinigt',exact:true}).click()
    await expect(page.getByRole('cell',{name:'PRIVATE_PERSON_1',exact:true})).toHaveCount(0)
    const downloading=page.waitForEvent('download')
    await page.getByRole('button',{name:'Herunterladen',exact:true}).click()
    const download=await downloading
    expect(download.suggestedFilename()).toContain('_bereinigt.')
    const b=await readFile((await download.path())!)
    expect(b.includes('PRIVATE_PERSON_1')).toBe(false)
    expect(b.includes('PRIVATE_TRAILER')).toBe(false)
    const same=await page.evaluate(async({before,after,type})=>{
      const fingerprint=async(values:number[])=>{const bitmap=await createImageBitmap(new Blob([new Uint8Array(values)],{type}));const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;const ctx=c.getContext('2d')!;ctx.drawImage(bitmap,0,0);return{w:c.width,h:c.height,pixels:Array.from(ctx.getImageData(0,0,c.width,c.height).data)}}
      return JSON.stringify(await fingerprint(before))===JSON.stringify(await fingerprint(after))
    },{before:f.bytes,after:Array.from(b),type:`image/${f.format}`})
    expect(same).toBe(true)
  }
  const downloading=page.waitForEvent('download')
  await page.getByRole('button',{name:/Alle als ZIP/}).click()
  const archive=await readFile((await (await downloading).path())!)
  const content=unzipSync(archive)
  expect(Object.keys(content)).toHaveLength(3)
  for(const b of Object.values(content)) expect(Buffer.from(b).includes('PRIVATE_PERSON_1')).toBe(false)
  await page.screenshot({path:'artifacts/processed.png',fullPage:true})
})

test('MP4 metadata removal retains decodable audio/video and strips location, title and timestamp',async({page})=>{
  await page.goto('/')
  const video=await page.evaluate(async()=>{
    // Use the same local engine to create an actual MP4 fixture; no network fixtures.
    const {FFmpeg}=await import('/node_modules/@ffmpeg/ffmpeg/dist/esm/index.js')
    const engine=new FFmpeg()
    await engine.load({coreURL:new URL('/ffmpeg/ffmpeg-core.js',location.href).href,wasmURL:new URL('/ffmpeg/ffmpeg-core.wasm',location.href).href})
    const code=await engine.exec(['-f','lavfi','-i','color=c=blue:s=160x120:r=5:d=1','-f','lavfi','-i','sine=frequency=440:duration=1','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-metadata','title=PRIVATE_VIDEO_TITLE','-metadata','location=+52.5200+013.4050/','-metadata','creation_time=2024-01-02T03:04:05Z','-shortest','sample.mp4'])
    if(code!==0)throw new Error('Fixture generation failed')
    const probeCode=await engine.ffprobe(['-v','error','-show_format','-show_streams','-of','json','sample.mp4','-o','probe.json'])
    if(probeCode!==0 && probeCode!==-1) throw new Error('Fixture probe failed')
    JSON.parse(await engine.readFile('probe.json','utf8') as string)
    const bytes=await engine.readFile('sample.mp4');engine.terminate();return Array.from(bytes as Uint8Array)
  })
  await page.locator('input[type=file]').setInputFiles({name:'private.mp4',mimeType:'video/mp4',buffer:Buffer.from(video)})
  await expect(page.locator('.file-copy small')).not.toHaveText('Wird analysiert',{timeout:60000})
  await expect(page.locator('.file-copy small')).toHaveText('Analysiert')
  await expect(page.getByRole('cell',{name:'PRIVATE_VIDEO_TITLE'})).toBeVisible()
  await page.getByRole('button',{name:'Metadaten entfernen',exact:true}).click()
  await expect(page.getByRole('button',{name:'Herunterladen',exact:true})).toBeVisible({timeout:60000})
  await page.getByRole('button',{name:'Bereinigt',exact:true}).click()
  await expect(page.getByRole('cell',{name:'PRIVATE_VIDEO_TITLE'})).toHaveCount(0)
  const downloading=page.waitForEvent('download')
  await page.getByRole('button',{name:'Herunterladen',exact:true}).click()
  const bytes=await readFile((await (await downloading).path())!)
  expect(bytes.includes('PRIVATE_VIDEO_TITLE')).toBe(false)
  expect(bytes.includes('+52.5200')).toBe(false)
  const result=await page.evaluate(async(values:number[])=>{
    const {FFmpeg}=await import('/node_modules/@ffmpeg/ffmpeg/dist/esm/index.js')
    const engine=new FFmpeg();await engine.load({coreURL:new URL('/ffmpeg/ffmpeg-core.js',location.href).href,wasmURL:new URL('/ffmpeg/ffmpeg-core.wasm',location.href).href})
    await engine.writeFile('clean.mp4',new Uint8Array(values))
    await engine.ffprobe(['-v','error','-show_format','-show_streams','-of','json','clean.mp4','-o','info.json'])
    const info=JSON.parse(await engine.readFile('info.json','utf8') as string)
    const decode=await engine.exec(['-i','clean.mp4','-f','null','-'])
    engine.terminate();return{info,decode}
  },Array.from(bytes))
  expect(result.decode).toBe(0)
  expect(result.info.streams.map((s:{codec_type:string})=>s.codec_type)).toEqual(['video','audio'])
  expect(result.info.format.tags?.title).toBeUndefined()
  expect(result.info.format.tags?.creation_time).toBeUndefined()
})
