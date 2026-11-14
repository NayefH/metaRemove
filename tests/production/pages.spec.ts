import { test, expect } from '@playwright/test'
test('production under a repository subpath loads local workers and cleans a WebM and PNG',async({page})=>{
  const requests:string[]=[];const errors:string[]=[]
  page.on('request',request=>{if(request.method()!=='GET')requests.push(`${request.method()} ${request.url()}`)})
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto('./')
  const files=await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=160;canvas.height=120
    const context=canvas.getContext('2d')!;context.fillStyle='#58724c';context.fillRect(0,0,160,120)
    const image=await new Promise<Blob>(r=>canvas.toBlob(b=>r(b!),'image/png'))
    const stream=canvas.captureStream(0)
    const track=stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack
    const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'})
    const chunks:Blob[]=[]
    const recording=new Promise<Blob>(resolve=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=()=>resolve(new Blob(chunks,{type:'video/webm'}))})
    recorder.start()
    for(let i=0;i<10;i++){context.fillStyle=`rgb(${i*20},100,80)`;context.fillRect(0,0,160,120);track.requestFrame();await new Promise(r=>setTimeout(r,100))}
    recorder.stop()
    const video=await recording
    stream.getTracks().forEach(t=>t.stop())
    return[{name:'photo.png',type:'image/png',bytes:Array.from(new Uint8Array(await image.arrayBuffer()))},{name:'recording.webm',type:'video/webm',bytes:Array.from(new Uint8Array(await video.arrayBuffer()))}]
  })
  await page.locator('input[type=file]').setInputFiles(files.map(f=>({name:f.name,mimeType:f.type,buffer:Buffer.from(f.bytes)})))
  await expect(page.locator('.file-copy small')).toHaveCount(2)
  await expect(page.locator('.file-copy small').filter({hasText:'Wird analysiert'})).toHaveCount(0,{timeout:90000})
  if(await page.locator('.file-copy .status-error').count()){
    await page.locator('.file-row').filter({has:page.locator('.status-error')}).locator('.file-select').click()
    throw new Error(await page.getByRole('alert').innerText())
  }
  await expect(page.getByText('Analysiert',{exact:true})).toHaveCount(2)
  await page.getByRole('button',{name:'Alle bereinigen'}).click()
  await expect(page.locator('.file-copy .status-clean')).toHaveCount(2,{timeout:90000})
  const downloading=page.waitForEvent('download')
  await page.getByRole('button',{name:/Alle als ZIP/}).click()
  expect((await downloading).suggestedFilename()).toBe('metaremove_bereinigt.zip')
  expect(requests).toEqual([])
  expect(errors).toEqual([])
})
