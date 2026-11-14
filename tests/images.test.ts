import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stripImage, imageKind } from '../src/lib/images.ts'

const join = (...parts: Uint8Array[]) => new Uint8Array(Buffer.concat(parts))
const text = (s:string) => new TextEncoder().encode(s)
const marker = (code:number,payload:Uint8Array) => join(new Uint8Array([255,code,(payload.length+2)>>8,(payload.length+2)&255]),payload)
const scan = join(marker(218,new Uint8Array([1,1,0,0,63,0])),new Uint8Array([20,255,0,225,77,255,208,12]))
const jpeg = (...segments:Uint8Array[]) => join(new Uint8Array([255,216]),...segments,scan,new Uint8Array([255,217]))
function crc(b:Uint8Array) {let n=0xffffffff;for(const v of b){n^=v;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0)}return(n^0xffffffff)>>>0}
function chunk(type:string,payload:Uint8Array){const b=Buffer.alloc(payload.length+12);b.writeUInt32BE(payload.length);b.set(text(type),4);b.set(payload,8);b.writeUInt32BE(crc(b.subarray(4,-4)),b.length-4);return b}
const png = (...extra:Uint8Array[]) => join(new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',new Uint8Array([0,0,0,1,0,0,0,1,8,6,0,0,0])),...extra,chunk('IDAT',new Uint8Array([1,2,3])),chunk('IEND',new Uint8Array()))
function webpChunk(type:string,payload:Uint8Array){const b=Buffer.alloc(8+payload.length+(payload.length%2));b.set(text(type));b.writeUInt32LE(payload.length,4);b.set(payload,8);return b}
function webp(...chunks:Uint8Array[]){const b=join(text('RIFF'),new Uint8Array(4),text('WEBP'),...chunks);new DataView(b.buffer).setUint32(4,b.length-8,true);return b}

test('detects supported magic bytes and rejects unknown files',()=>{assert.equal(imageKind(jpeg()),'jpeg');assert.equal(imageKind(png()),'png');assert.equal(imageKind(text('no image')),undefined)})
test('JPEG removes EXIF, XMP, IPTC, comments and trailers while preserving scan bytes',()=>{const b=jpeg(marker(225,text('Exif\0\0SECRET GPS')),marker(237,text('Author SECRET')),marker(254,text('PRIVATE')));const result=stripImage(join(b,text('trailer')));assert.deepEqual(result.bytes,jpeg());assert.equal(result.removed.length,4)})
test('JPEG retains ICC and Adobe colour data',()=>{const icc=marker(226,text('ICC_PROFILE\0profile'));const adobe=marker(238,text('Adobe data'));assert.deepEqual(stripImage(jpeg(icc,adobe)).bytes,jpeg(icc,adobe))})
test('JPEG retains minimal orientation without original EXIF',()=>{const result=stripImage(jpeg(marker(225,text('SECRET'))),6);assert.equal(new DataView(result.bytes.buffer).getUint16(4),34);assert.equal(result.bytes[30],6);assert.ok(!Buffer.from(result.bytes).includes('SECRET'));assert.equal(stripImage(result.bytes,6).bytes.length,result.bytes.length)})
test('progressive JPEG strips metadata between scans',()=>{const b=join(new Uint8Array([255,216]),scan,marker(254,text('private')),scan,new Uint8Array([255,217]));assert.deepEqual(stripImage(b).bytes,join(new Uint8Array([255,216]),scan,scan,new Uint8Array([255,217])))})
test('PNG strips text, timestamp, unknown ancillary chunks and trailing payload',()=>{const b=png(chunk('tEXt',text('Author\0private')),chunk('tIME',new Uint8Array(7)),chunk('aaAa',text('private')));assert.deepEqual(stripImage(join(b,text('PRIVATE'))).bytes,png())})
test('PNG preserves animation and colour profile chunks',()=>{const animation=chunk('acTL',new Uint8Array(8));const colour=chunk('sRGB',new Uint8Array([0]));assert.deepEqual(stripImage(png(animation,colour)).bytes,png(animation,colour))})
test('PNG rejects broken CRC, truncation and unknown critical chunks',()=>{const bad=png();bad[20]^=1;assert.throws(()=>stripImage(bad));assert.throws(()=>stripImage(png().slice(0,-1)));assert.throws(()=>stripImage(png(chunk('AAAA',text('x')))))})
test('PNG retains only orientation in replacement EXIF and computes a valid CRC',()=>{const b=stripImage(png(chunk('eXIf',text('SECRET'))),8).bytes;assert.ok(!Buffer.from(b).includes('SECRET'));assert.doesNotThrow(()=>stripImage(b,8))})
test('WebP removes EXIF/XMP and updates extended flags and RIFF length',()=>{const header=webpChunk('VP8X',new Uint8Array([12,0,0,0,0,0,0,0,0,0]));const pixels=webpChunk('VP8 ',new Uint8Array([1,2,3]));const b=webp(header,webpChunk('EXIF',text('SECRET')),pixels,webpChunk('XMP ',text('PRIVATE')));const result=stripImage(b);assert.equal(result.bytes[20]&12,0);assert.equal(new DataView(result.bytes.buffer).getUint32(4,true),result.bytes.length-8);assert.ok(!Buffer.from(result.bytes).includes('SECRET'));assert.ok(Buffer.from(result.bytes).includes(pixels))})
test('WebP preserves animation and ICC profiles',()=>{const b=webp(webpChunk('ICCP',text('colour')),webpChunk('ANIM',new Uint8Array(6)),webpChunk('ANMF',new Uint8Array(16)));assert.deepEqual(stripImage(b).bytes,b)})
test('malformed input fails closed',()=>{for(const b of [new Uint8Array([255,216]),new Uint8Array([255,216,255,225,255,255]),webp(webpChunk('EXIF',text('secret'))),text('random')])assert.throws(()=>stripImage(b))})
