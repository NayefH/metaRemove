# MetaRemove

Fotos und Videos lokal im Browser untersuchen, persönliche Metadaten entfernen und bereinigte Dateien einzeln oder als ZIP herunterladen.

**Website:** https://nayefh.github.io/metaRemove/

## Funktionen

- Mehrere Dateien per Dateiauswahl oder Drag-and-drop hinzufügen.
- Vorschau und durchsuchbare Metadaten mit Original-/Bereinigt-Vergleich.
- JPEG: EXIF, XMP, IPTC, Kommentare, weitere APP-Blöcke und angehängte Daten entfernen.
- PNG: Text, EXIF, Zeitstempel und unbekannte Zusatzblöcke entfernen; CRC prüfen.
- WebP: EXIF, XMP und unbekannte Zusatzblöcke entfernen; RIFF-Länge und Flags aktualisieren.
- Fotos ohne Neukodierung: komprimierte Bilddaten, Animationen, Farbprofile und minimale technische Ausrichtungsangaben bleiben erhalten.
- MP4, MOV, WebM, MKV: mit FFmpeg die Bild- und Tonspuren ohne Neukodierung in einen neuen Container übernehmen. Globale/Spur-Metadaten, Kapitel, Untertitel und Datenspuren entfernen. Ausgabe anschließend mit FFprobe prüfen.
- Jede Ausgabe erneut analysieren. Bei erkannten verbliebenen persönlichen Angaben den Download blockieren.
- Kein Backend, keine Datei-Uploads, keine Analyse-Dienste, keine Browser-Speicherung. Alle Abhängigkeiten werden von derselben Website bereitgestellt.

## Lokal starten

Node.js 24 oder neuer:

```sh
npm ci
npm run dev
```

Die Installation kopiert den Single-Thread-FFmpeg-Kern nach `public/ffmpeg/`. Diese generierten Dateien werden nicht eingecheckt. Das etwa 32 MB große Videomodul wird im Browser erst bei der ersten Videodatei geladen. Es benötigt keine Cross-Origin-Isolation und funktioniert auf GitHub Pages.

## Prüfen und bauen

```sh
npm test
npm run build
npm run preview
```

Die Binärtests prüfen progressive JPEGs, Ausrichtung, Animationen, Farbprofile, beschädigte Dateien und angehängte Daten.

```sh
npm run test:e2e
```

Die Browsertests benötigen lokal installiertes Chrome. Unter Windows wird der Standardpfad verwendet; alternativ `PLAYWRIGHT_CHROME_PATH` auf die Browserdatei setzen. Sie erzeugen echte Foto-/Videodateien und prüfen Metadaten, identische dekodierte Bildpixel, erhaltene Ausrichtung, Video-/Audiodekodierung, Einzel- und ZIP-Downloads sowie das mobile Layout.

## GitHub Pages

Der Workflow `.github/workflows/deploy.yml` installiert die Abhängigkeiten, prüft die Bildbereinigung, erstellt `dist/` und veröffentlicht über GitHub Actions auf Pages. Jeder Push auf `main` löst ein Deployment aus. In den Repository-Einstellungen muss **Pages → Source → GitHub Actions** aktiviert sein. `base: './'` unterstützt Repository-Unterverzeichnisse.

## Grenzen

Pro Datei sind maximal 250 MB erlaubt, pro Sitzung 30 Dateien und insgesamt 500 MB. Auf Geräten mit wenig RAM können kleinere Dateien nötig sein. Originaldateien bleiben unverändert. Dateinamen bleiben erhalten und können persönliche Angaben enthalten.

Technische Angaben wie Auflösung, Codec, Bildausrichtung, Farbprofil und neu erzeugte Containerkennungen bleiben erhalten. Die Anzeige liest gängige EXIF-/XMP-/IPTC-Felder und Video-Container-/Spur-Tags; nicht jeder herstellerspezifische Binärblock lässt sich menschenlesbar darstellen. Die Containerbereinigung entfernt die entsprechenden Blöcke trotzdem. Sichtbare Bildinhalte, Wasserzeichen sowie in komprimierte Bild-/Tonspuren eingebettete Informationen werden nicht verändert. Die Anwendung garantiert keine Anonymität.

HEIC, AVIF, RAW und GIF werden derzeit nicht unterstützt. Browser-Videovorschau hängt vom Codec ab; die Containerverarbeitung kann trotzdem funktionieren. Bei nicht unterstützten Dateien oder gescheiterter Prüfung wird ein Fehler angezeigt und keine bereinigte Ausgabe angeboten.

## Bibliotheken

React, Vite, TypeScript, lucide-react, exifr, fflate sowie FFmpeg.wasm. Lizenz- und Quellhinweise stehen in [THIRD_PARTY.md](THIRD_PARTY.md).
