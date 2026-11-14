const groups = [
  {
    title: 'Dateien und Metadaten',
    items: [
      {
        name: 'File API, ArrayBuffer und Blob',
        description: 'Die File API liest ausgewählte Dateien vom Gerät. ArrayBuffer stellt ihre Bytes im Arbeitsspeicher bereit. Blob und temporäre Blob-URLs ermöglichen Vorschauen und Downloads, ohne die Dateien an einen Server zu senden.',
      },
      {
        name: 'exifr · EXIF, XMP und IPTC',
        description: 'exifr liest gängige Bild-Metadaten: EXIF enthält etwa Kamera- und Aufnahmedaten, XMP erweiterte Beschreibungen und IPTC beispielsweise Urheberangaben. Auch GPS-Koordinaten können in diesen Zusatzdaten stehen.',
      },
      {
        name: 'Binäre Containerbereinigung',
        description: 'Eigener TypeScript-Code entfernt Zusatzblöcke direkt aus JPEG, PNG und WebP. Uint8Array und DataView lesen und ändern dafür einzelne Bytes. PNG-Prüfsummen (CRC) erkennen beschädigte Blöcke. Komprimierte Bilddaten, Farbprofile und die nötige Ausrichtung bleiben erhalten.',
      },
      {
        name: 'FFmpeg.wasm und WebAssembly',
        description: 'WebAssembly führt den FFmpeg-Kern im Browser aus. FFmpeg kopiert die Bild- und Tonspuren in einen neuen Video-Container und entfernt dabei Container-Metadaten. Dieses Verfahren heißt Remuxing; Bild und Ton werden nicht neu kodiert.',
      },
      {
        name: 'FFprobe und erneute Analyse',
        description: 'FFprobe liest die Container- und Spurdaten von Videos vor und nach der Bereinigung. Bereinigte Fotos werden ebenfalls erneut analysiert. Werden dabei noch persönliche Angaben erkannt, wird kein Download freigegeben.',
      },
      {
        name: 'Web Workers',
        description: 'Das Videomodul arbeitet in einem separaten Browser-Thread. Dadurch blockiert die aufwendige Videoverarbeitung nicht direkt die Bedienung der Oberfläche. Die Verarbeitung bleibt auf dem Gerät.',
      },
      {
        name: 'fflate · ZIP-Archive',
        description: 'fflate bündelt mehrere bereinigte Dateien zu einem ZIP-Archiv. Die Anwendung verwendet dabei keine zusätzliche Kompression. So können alle Ergebnisse gemeinsam heruntergeladen werden.',
      },
    ],
  },
  {
    title: 'Oberfläche und Darstellung',
    items: [
      {
        name: 'HTML und CSS',
        description: 'HTML strukturiert Überschriften, Formulare und Metadaten-Tabellen. CSS legt Schrift, Farben und Abstände fest. Grid, Flexbox und Media Queries passen das Layout an Handy, Tablet und Desktop an.',
      },
      {
        name: 'React und React DOM',
        description: 'React organisiert die Oberfläche in Komponenten und verwaltet Dateiauswahl, Status und Metadatenansicht. React DOM überträgt Änderungen in die angezeigte Webseite, ohne die gesamte Seite neu zu laden.',
      },
      {
        name: 'TypeScript',
        description: 'TypeScript ergänzt JavaScript um Typen für Dateien, Metadaten und Verarbeitungsergebnisse. Der Build prüft diese Typen, bevor der Code als JavaScript im Browser ausgeführt wird.',
      },
      {
        name: 'lucide-react · SVG-Symbole',
        description: 'lucide-react liefert die Symbole für Upload, Suche, Status und Download. SVG-Grafiken bleiben beim Vergrößern scharf und übernehmen die goldene Farbe der Oberfläche.',
      },
    ],
  },
  {
    title: 'Entwicklung, Prüfung und Hosting',
    items: [
      {
        name: 'Node.js, npm und Vite',
        description: 'Node.js führt die Entwicklungswerkzeuge aus, npm installiert die Abhängigkeiten. Vite stellt den lokalen Entwicklungsserver bereit und bündelt den Code für die Veröffentlichung. Der FFmpeg-Kern wird als eigene Datei mit ausgeliefert.',
      },
      {
        name: 'Node.js Test Runner, Playwright und ESLint',
        description: 'Der Node.js Test Runner prüft die binäre Bildbereinigung. Playwright testet im Browser Dateiauswahl, Metadaten, Downloads und verschiedene Bildschirmbreiten. ESLint steht zusätzlich für die statische Prüfung des Quellcodes bereit.',
      },
      {
        name: 'Git, GitHub Actions und GitHub Pages',
        description: 'Git versioniert den Quellcode. Bei einem Push auf main führt GitHub Actions Tests und Build aus. GitHub Pages veröffentlicht die fertigen HTML-, CSS-, JavaScript- und WebAssembly-Dateien über HTTPS.',
      },
      {
        name: 'Content Security Policy (CSP)',
        description: 'Die im HTML festgelegte CSP beschränkt Skriptquellen und Netzwerkzugriffe auf die eigene Website und benötigte lokale Blob-Adressen. Alle Laufzeitbibliotheken werden von derselben Website geladen; die Dateiverarbeitung benötigt kein Backend.',
      },
    ],
  },
]

export default function TechnologySection() {
  return (
    <section className="technology-section" id="techniken" aria-labelledby="technology-title">
      <h2 id="technology-title">Verwendete Techniken</h2>
      <p className="technology-intro">Diese Verfahren und Werkzeuge werden zum Lesen, Bereinigen und Bereitstellen der Dateien eingesetzt.</p>
      <div className="technology-groups">
        {groups.map(group => (
          <section className="technology-group" key={group.title}>
            <h3>{group.title}</h3>
            <dl>
              {group.items.map(item => (
                <div key={item.name}>
                  <dt>{item.name}</dt>
                  <dd>{item.description}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <p className="technology-requirements">Für die Nutzung genügt ein moderner Browser mit WebAssembly. Node.js und npm werden nur für Entwicklung und Build benötigt.</p>
    </section>
  )
}
