import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowDownToLine, ArrowRight, Check, CheckCheck, ChevronDown, ChevronRight, CircleHelp, CodeXml, FileImage, Film, Fingerprint, FolderOpen, Info, Layers, LoaderCircle, LockKeyhole, MapPin, Plus, Search, Shield, ShieldCheck, Sparkles, Upload, X } from 'lucide-react'
import { zipSync } from 'fflate'
import { cleanMedia, cleanName, download, formatSize, inspectMedia, isVideo, MAX_FILE_SIZE, supported } from './lib/media'
import type { MediaInfo } from './lib/media'
import './App.css'

type MediaFile = { id:string; file:File; url:string; state:'reading'|'ready'|'cleaning'|'clean'|'error'; status:string; info?:MediaInfo; result?:Blob; after?:MediaInfo; error?:string }
const uid = () => crypto.randomUUID()
function App() {
  const [files, setFiles] = useState<MediaFile[]>([])
  const [selected, setSelected] = useState<string>()
  const [dragging, setDragging] = useState(false)
  const [tab, setTab] = useState<'original'|'clean'>('original')
  const [filter, setFilter] = useState('')
  const [notice, setNotice] = useState('')
  const [help, setHelp] = useState(false)
  const [packing, setPacking] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const urls = useRef(new Set<string>())
  const batchLock = useRef(false)
  const current = files.find(f => f.id === selected)
  const ready = files.filter(f => f.state === 'ready')
  const cleaned = files.filter(f => f.state === 'clean')
  const busy = files.some(f => f.state === 'reading' || f.state === 'cleaning')
  const patch = (id:string, update:Partial<MediaFile>) => setFiles(all => all.map(f => f.id === id ? {...f,...update} : f))
  useEffect(() => () => { for (const url of urls.current) URL.revokeObjectURL(url) }, [])
  useEffect(() => {
    if (!help) return
    const opener = document.activeElement as HTMLElement | null
    const onKey = (e:KeyboardEvent) => {
      if (e.key === 'Escape') setHelp(false)
      if (e.key === 'Tab') {
        const buttons = document.querySelectorAll<HTMLButtonElement>('.help-dialog button')
        const first = buttons[0], last = buttons[buttons.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); opener?.focus() }
  }, [help])

  async function addFiles(list: FileList | File[]) {
    const accepted: MediaFile[] = []
    const rejected: string[] = []
    let total = files.reduce((n,f) => n + f.file.size, 0)
    for (const file of Array.from(list)) {
      if (!supported(file)) { rejected.push(`${file.name}: Dateiformat nicht unterstützt.`); continue }
      if (!file.size) { rejected.push(`${file.name}: Die Datei ist leer.`); continue }
      if (file.size > MAX_FILE_SIZE) { rejected.push(`${file.name}: Maximal 250 MB pro Datei.`); continue }
      if (files.length + accepted.length >= 30 || total + file.size > 500 * 1024 * 1024) { rejected.push('Maximal 30 Dateien und insgesamt 500 MB pro Sitzung.'); break }
      if (files.some(f => f.file.name === file.name && f.file.size === file.size && f.file.lastModified === file.lastModified)) continue
      const url = URL.createObjectURL(file); urls.current.add(url)
      accepted.push({id:uid(),file,url,state:'reading',status:'Metadaten werden gelesen …'})
      total += file.size
    }
    if (rejected.length) setNotice(rejected.join(' '))
    if (!accepted.length) return
    setFiles(all => [...all,...accepted])
    setSelected(previous => previous ?? accepted[0].id)
    for (const entry of accepted) {
      try {
        const info = await inspectMedia(entry.file, status => patch(entry.id,{status}))
        patch(entry.id,{info,state:'ready',status:'Bereit zur Bereinigung'})
      } catch (error) { patch(entry.id,{state:'error',error:error instanceof Error ? error.message : 'Die Datei konnte nicht gelesen werden.'}) }
    }
  }
  async function clean(entry:MediaFile) {
    if (!entry.info || entry.state !== 'ready') return
    patch(entry.id,{state:'cleaning',status:'Bereinigung wird vorbereitet …'})
    try {
      const result = await cleanMedia(entry.file,entry.info,status => patch(entry.id,{status}))
      patch(entry.id,{state:'clean',result:result.blob,after:result.info,status:'Bereinigt und geprüft'})
    } catch (error) { patch(entry.id,{state:'error',error:error instanceof Error ? error.message : 'Die Bereinigung ist fehlgeschlagen.'}) }
  }
  async function cleanAll() {
    if (batchLock.current) return
    batchLock.current = true
    try { for (const entry of ready) await clean(entry) } finally { batchLock.current = false }
  }
  function remove(entry:MediaFile) {
    if (entry.state === 'reading' || entry.state === 'cleaning') return
    URL.revokeObjectURL(entry.url); urls.current.delete(entry.url)
    setFiles(all => all.filter(f => f.id !== entry.id))
    if (selected === entry.id) { setSelected(files.find(f => f.id !== entry.id)?.id); setTab('original') }
  }
  async function downloadAll() {
    if (!cleaned.length || packing) return
    setPacking(true)
    try {
      const content:Record<string,Uint8Array> = {}
      for (const [index,entry] of cleaned.entries()) content[`${String(index + 1).padStart(2,'0')}_${cleanName(entry.file.name)}`] = new Uint8Array(await entry.result!.arrayBuffer())
      const zip = zipSync(content,{level:0})
      download(new Blob([zip.buffer as ArrayBuffer],{type:'application/zip'}),'metaremove_bereinigt.zip')
    } catch { setNotice('Das ZIP-Archiv konnte nicht erstellt werden. Bitte lade die Dateien einzeln herunter.') }
    finally { setPacking(false) }
  }
  const info = tab === 'clean' ? current?.after : current?.info
  const metadata = info?.metadata.filter(row => `${row.label} ${row.value}`.toLowerCase().includes(filter.toLowerCase())) ?? []
  const personal = current?.info?.metadata.filter(m => m.personal).length ?? 0

  return (
    <>
      <header className="topbar">
        <a className="brand" href="./" aria-label="MetaRemove Startseite"><span className="brand-icon"><Layers size={22}/></span><span>meta<span className="brand-light">remove</span><span className="brand-dot">.</span></span></a>
        <nav><a className="nav-active" href="#workspace">Workspace</a><button onClick={() => setHelp(true)}>So funktioniert’s <CircleHelp size={14}/></button></nav>
        <span className="local-badge"><span className="live-dot"/> Lokal auf deinem Gerät</span>
      </header>

      <main id="workspace">
        <section className="intro">
          <div className="eyebrow"><span/> DEINE DATEIEN. DEINE PRIVATSPHÄRE.</div>
          <h1>Teile den Moment.<br/><span>Nicht deine Metadaten.</span></h1>
          <p>Entdecke, was in deinen Fotos und Videos steckt.<br className="desktop-break"/> Entferne persönliche Daten, bevor du sie teilst.</p>
          <div className="intro-note"><ShieldCheck size={15}/><span>100 % im Browser</span><span className="note-divider"/><span>Kein Upload. Kein Konto.</span></div>
          <div className="intro-decoration" aria-hidden="true"><div className="orbital orbital-one"/><div className="orbital orbital-two"/><div className="deco-card back"><MapPin size={25}/><span>Standort</span><i>52.5200° N</i><div className="strikethrough"/></div><div className="deco-card front"><ShieldCheck size={36}/><span>Einfach privat.</span><div><span/>Metadaten entfernt</div></div><span className="deco-spark"><Sparkles size={20}/></span></div>
        </section>

        <section className="workspace-heading"><div><h2>Dein Workspace <span className="beta-label">LOKAL & PRIVAT</span></h2><p>Dateien hinzufügen, prüfen und mit einem Klick bereinigen.</p></div><button className="text-button" onClick={() => setHelp(true)}><Info size={15}/> Was sind Metadaten?</button></section>

        <section className={`dropzone ${dragging ? 'dragging' : ''}`} onDragOver={e => {e.preventDefault();setDragging(true)}} onDragLeave={e => {if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)}} onDrop={e => {e.preventDefault();setDragging(false);void addFiles(e.dataTransfer.files)}} aria-label="Dateien per Drag-and-drop hinzufügen">
          <div className="upload-icon"><Upload size={25}/><span><Plus size={12}/></span></div>
          <div className="drop-copy"><h3>{dragging ? 'Hier loslassen. Bleibt bei dir.' : 'Fotos & Videos hier ablegen'}</h3><p>oder <button onClick={() => input.current?.click()}>Dateien auswählen <ArrowRight size={13}/></button></p></div>
          <div className="drop-formats"><div><span>JPG</span><span>PNG</span><span>WEBP</span><span>VIDEO</span></div><p>MP4, MOV, WebM, MKV · bis zu 250 MB pro Datei</p></div>
          <input ref={input} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.mp4,.mov,.webm,.mkv" className="visually-hidden" aria-label="Fotos und Videos auswählen" onChange={e => {if(e.target.files) void addFiles(e.target.files);e.target.value=''}}/>
        </section>

        {notice && <div className="notice" role="alert"><Info size={17}/><p>{notice}</p><button onClick={() => setNotice('')} aria-label="Hinweis schließen"><X size={16}/></button></div>}

        <section className="workbench">
          <div className="file-panel">
            <div className="panel-toolbar"><h3>Deine Dateien <span className="count">{files.length}</span></h3><button title="Dateien hinzufügen" aria-label="Weitere Dateien hinzufügen" onClick={() => input.current?.click()}><Plus size={18}/></button></div>
            {files.length ? <div className="file-list">{files.map(entry => <div key={entry.id} className={`file-row ${entry.id === selected ? 'selected' : ''}`}>
              <button className="file-select" onClick={() => {setSelected(entry.id);setTab('original');setFilter('')}}><span className="file-thumbnail">{isVideo(entry.file) ? <Film size={23}/> : <img src={entry.url} alt="" onError={e => { e.currentTarget.style.display='none' }}/>}</span><span className="file-copy"><strong>{entry.file.name}</strong><span>{formatSize(entry.file.size)} <span className="middle-dot">·</span> {entry.file.name.split('.').pop()?.toUpperCase()}</span><small className={entry.state === 'clean' ? 'status-clean' : entry.state === 'error' ? 'status-error' : ''}>{entry.state === 'reading' || entry.state === 'cleaning' ? <LoaderCircle size={11} className="spin"/> : entry.state === 'clean' ? <CheckCheck size={12}/> : entry.state === 'error' ? <Info size={11}/> : <span className="status-dot"/>}{entry.state === 'reading' ? 'Wird analysiert' : entry.state === 'cleaning' ? 'Wird bereinigt' : entry.state === 'clean' ? 'Bereinigt' : entry.state === 'error' ? 'Fehler' : 'Analysiert'}</small></span></button>
              <button className="remove-file" aria-label={`${entry.file.name} aus Liste entfernen`} title="Aus Liste entfernen" disabled={entry.state === 'reading' || entry.state === 'cleaning'} onClick={() => remove(entry)}><X size={14}/></button>
            </div>)}</div> : <div className="empty-files"><div className="empty-file-art"><FileImage size={26}/><Film size={26}/></div><h4>Platz für deine Dateien.</h4><p>Füge ein Foto oder Video hinzu.<br/>Den Rest übernehmen wir.</p><button className="small-outline" onClick={() => input.current?.click()}><Plus size={14}/> Dateien hinzufügen</button></div>}
            <div className="file-panel-footer"><LockKeyhole size={13}/><span>Deine Originale bleiben unverändert.</span></div>
          </div>

          <div className="detail-panel">
            <div className="panel-toolbar detail-toolbar"><h3><Fingerprint size={17}/> Metadaten-Inspektor</h3><span className="panel-hint">{current ? current.file.name.split('.').pop()?.toUpperCase() : 'Wähle eine Datei aus'}</span></div>
            {current ? <>
              <div className="preview-row"><div className="media-preview">{isVideo(current.file) ? <video key={current.id} src={current.url} controls preload="metadata" aria-label="Video-Vorschau"/> : <img src={current.url} alt={`Vorschau von ${current.file.name}`}/>}</div><div className="preview-copy"><h4 title={current.file.name}>{current.file.name}</h4><p>{formatSize(current.file.size)}{current.info?.width ? ` · ${current.info.width} × ${current.info.height} px` : ''}{current.info?.duration ? ` · ${current.info.duration.toLocaleString('de-DE',{maximumFractionDigits:1})} s` : ''}</p>{current.state === 'clean' ? <span className="pill clean-pill"><ShieldCheck size={13}/> Bereinigt und geprüft</span> : current.info ? <span className="pill"><Info size={13}/>{personal > 0 ? `${personal} persönliche Angaben` : 'Analyse abgeschlossen'}</span> : null}</div></div>
              {(current.state === 'reading' || current.state === 'cleaning') && <div className="processing" role="status"><LoaderCircle className="spin" size={18}/>{current.status}</div>}
              {current.state === 'error' && <div className="file-error" role="alert"><Info size={19}/><div><strong>Die Datei konnte nicht verarbeitet werden.</strong><p>{current.error}</p>{current.info && <button className="small-outline" onClick={() => patch(current.id,{state:'ready',error:undefined})}>Erneut versuchen</button>}</div></div>}
              {current.info && <>
                <div className="metadata-tools"><div className="tabs"><button className={tab === 'original' ? 'active' : ''} onClick={() => setTab('original')}>Original <span>{current.info.metadata.length}</span></button><button disabled={!current.after} className={tab === 'clean' ? 'active' : ''} onClick={() => setTab('clean')}>Bereinigt {current.after && <Check size={12}/>}</button></div><label className="metadata-search"><Search size={14}/><input placeholder="Metadaten suchen" value={filter} onChange={e => setFilter(e.target.value)} aria-label="Metadaten durchsuchen"/></label></div>
                <div className="metadata-table">{metadata.length ? <table><thead><tr><th>Eigenschaft</th><th>Wert</th></tr></thead><tbody>{metadata.map((row,index) => <tr key={`${row.label}-${index}`}><td><span className={row.personal ? 'meta-dot personal-dot' : 'meta-dot'}/>{row.label}</td><td>{row.value}</td></tr>)}</tbody></table> : <div className="no-metadata"><ShieldCheck size={25}/><strong>{filter ? 'Keine passenden Einträge' : tab === 'clean' ? 'Keine persönlichen Metadaten übrig.' : 'Keine auslesbaren Metadaten gefunden.'}</strong><p>{filter ? 'Versuche einen anderen Suchbegriff.' : 'Technische Dateieigenschaften wie die Auflösung bleiben erhalten.'}</p></div>}</div>
                {!filter && tab === 'original' && current.info.blocks.length > 0 && <div className="blocks-note"><Layers size={13}/>{current.info.blocks.length} entfernbare Datenblöcke: {[...new Set(current.info.blocks)].join(', ')}</div>}
                <div className="detail-footer"><span><span className="meta-dot personal-dot"/>Persönliche Angaben<span className="meta-dot"/>Technische Angaben</span>{current.state === 'clean' ? <button className="button primary compact" onClick={() => download(current.result!,cleanName(current.file.name))}><ArrowDownToLine size={15}/> Herunterladen</button> : <button className="button primary compact" disabled={current.state !== 'ready' || busy} onClick={() => void clean(current)}><Sparkles size={15}/> Metadaten entfernen</button>}</div>
              </>}
            </> : <div className="empty-inspector"><div className="inspector-art"><div className="art-line"/><div className="art-line"/><div className="art-line short"/><span><Search size={24}/></span></div><h4>Ein Blick hinter das Bild.</h4><p>Wähle eine Datei aus, um versteckte Informationen<br className="desktop-break"/> wie Standort, Aufnahmezeit und Kameradaten zu sehen.</p><span className="empty-inspector-note"><span/> Bereit, wenn du es bist</span></div>}
          </div>
        </section>

        <section className="actionbar"><div className="action-summary"><span className="action-shield"><ShieldCheck size={21}/></span><div><strong>{cleaned.length ? `${cleaned.length} ${cleaned.length === 1 ? 'Datei bereit' : 'Dateien bereit'} zum Teilen` : 'Bereit für ein bisschen mehr Privatsphäre?'}</strong><p>{files.length ? `${files.length} ${files.length === 1 ? 'Datei' : 'Dateien'} · ${formatSize(files.reduce((n,f) => n + f.file.size,0))} insgesamt` : 'Füge deine ersten Dateien hinzu und leg los.'}</p></div></div><div className="action-buttons"><button className="button secondary" disabled={!cleaned.length || packing} onClick={() => void downloadAll()}>{packing ? <LoaderCircle className="spin" size={16}/> : <ArrowDownToLine size={16}/>}Alle als ZIP <span className="button-count">{cleaned.length}</span></button><button className="button primary" disabled={!ready.length || busy} onClick={() => void cleanAll()}>{busy ? <LoaderCircle className="spin" size={16}/> : <Sparkles size={16}/>}Alle bereinigen<ArrowRight size={16}/></button></div></section>

        <section className="trust-grid"><article><span className="trust-icon"><LockKeyhole size={21}/></span><div><h3>Bleibt auf deinem Gerät.</h3><p>Deine Dateien verlassen den Browser nicht.<br/>Keine Server, kein Tracking, keine Speicherung.</p></div></article><article><span className="trust-icon"><FileImage size={21}/></span><div><h3>Deine Qualität bleibt.</h3><p>Keine erneute Kompression. Bild und Ton<br/>bleiben so, wie du sie aufgenommen hast.</p></div></article><article><span className="trust-icon"><ShieldCheck size={21}/></span><div><h3>Weniger Daten. Mehr Kontrolle.</h3><p>Entferne Standort, Geräteinformationen<br/>und persönliche Angaben vor dem Teilen.</p></div></article></section>

        <details className="format-details"><summary>Gut zu wissen <ChevronDown size={14}/></summary><p>JPG, PNG und WebP werden ohne Neukodierung bereinigt. Ausrichtung, Farbprofile und Animationen bleiben erhalten. Videos in MP4, MOV, WebM und MKV werden lokal mit FFmpeg verarbeitet; das Videomodul lädt beim ersten Video etwa 32 MB. Es bleiben Bild- und Tonspuren erhalten; Kapitel, Untertitel und Datenspuren werden entfernt. Technische Containerangaben können weiterhin sichtbar sein. Sichtbare Inhalte, Wasserzeichen und in Bild- oder Tonspuren eingebettete Informationen werden nicht verändert. Die Bereinigung prüft Container-Metadaten, kann jedoch keine Anonymität garantieren. Der Dateiname bleibt im Download erhalten und kann selbst persönliche Angaben enthalten. Maximal 30 Dateien, 250 MB pro Datei und 500 MB pro Sitzung; auf Geräten mit wenig Arbeitsspeicher können kleinere Dateien nötig sein.</p></details>
      </main>

      <footer><a className="brand footer-brand" href="./"><Layers size={17}/><span>meta<span className="brand-light">remove</span><span className="brand-dot">.</span></span></a><span>Für Momente, die du teilen möchtest. Und Daten, die privat bleiben.</span><a href="https://github.com/NayefH/metaRemove" target="_blank" rel="noreferrer"><CodeXml size={15}/> GitHub <ChevronRight size={12}/></a></footer>

      {help && <div className="modal-backdrop" onClick={e => {if(e.target === e.currentTarget)setHelp(false)}}><dialog open className="help-dialog" aria-labelledby="help-title"><button className="modal-close" autoFocus onClick={() => setHelp(false)} aria-label="Erklärung schließen"><X size={20}/></button><span className="help-icon"><Shield size={28}/></span><h2 id="help-title">Dein Bild erzählt mehr,<br/>als du denkst.</h2><p>Fotos und Videos enthalten oft unsichtbare Zusatzinformationen: GPS-Koordinaten, Aufnahmezeit, Kameramodell oder deinen Namen. Diese Metadaten können beim Teilen mitgeschickt werden.</p><ol><li><span>01</span><div><strong>Dateien auswählen</strong><p>Ziehe Fotos oder Videos in den Workspace.</p></div><FolderOpen size={19}/></li><li><span>02</span><div><strong>Metadaten ansehen & entfernen</strong><p>Prüfe die Angaben und klicke auf „Bereinigen“.</p></div><Sparkles size={19}/></li><li><span>03</span><div><strong>Bereinigt herunterladen</strong><p>Einzeln oder gemeinsam als ZIP-Datei.</p></div><ArrowDown size={19}/></li></ol><div className="help-privacy"><LockKeyhole size={17}/>Alles passiert lokal in deinem Browser. Deine Originaldateien bleiben erhalten.</div><button className="button primary" onClick={() => setHelp(false)}>Verstanden. Los geht’s.<ArrowRight size={16}/></button></dialog></div>}
      <div className="visually-hidden" role="status" aria-live="polite">{busy ? 'Dateien werden verarbeitet.' : cleaned.length ? `${cleaned.length} Dateien bereinigt.` : files.length ? `${files.length} Dateien im Workspace.` : ''}</div>
    </>
  )
}
export default App
