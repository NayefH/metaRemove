import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
const root = resolve('dist')
const types = { '.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png' }
createServer(async(request,response)=>{
  try {
    const path = decodeURIComponent(new URL(request.url,'http://localhost').pathname)
    if (!path.startsWith('/metaRemove/')) { response.writeHead(404).end(); return }
    let file = resolve(root,path.slice('/metaRemove/'.length) || 'index.html')
    if (file !== root && !file.startsWith(root + sep)) { response.writeHead(403).end(); return }
    if ((await stat(file)).isDirectory()) file = resolve(file,'index.html')
    response.writeHead(200,{'Content-Type':types[extname(file)] || 'application/octet-stream'})
    response.end(await readFile(file))
  } catch { response.writeHead(404).end() }
}).listen(4173,'127.0.0.1')
