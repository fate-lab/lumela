<p align="center">
  <img src="branding/lumela-icon.svg" width="112" height="112" alt="Lumela logo">
</p>

<h1 align="center">Lumela</h1>

<p align="center">
  <b>Screenshots im CleanShot-Stil für Windows, macOS und Linux.</b><br>
  Aufnehmen, automatisch verschönern, beschriften und teilen. E-Mail-Adressen, Kartennummern, IP-Adressen und API-Schlüssel werden automatisch unkenntlich gemacht.<br>
  Kostenlos und Open Source.
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.tr.md">Türkçe</a> · Deutsch · <a href="README.es.md">Español</a> · <a href="README.ru.md">Русский</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <img src="docs/demo.gif" alt="Lumela-Demo" width="900">
</p>

## Warum Lumela?

Ein roher Screenshot sieht selten gut genug zum Teilen aus. Lumela macht daraus in einem Schritt ein sauberes Bild: ein passender Hintergrund, ausgewogener Rand, abgerundete Ecken und ein weicher Schatten. Pfeile und Text erklären, worum es geht, und sensible Daten sind unkenntlich, bevor sie jemand sieht.

- **Alles ist kostenlos.** Kein Konto, kein Abo, kein Wasserzeichen.
- **Privatsphäre zuerst.** Aufnahme, Texterkennung und Schwärzung laufen auf deinem Gerät. Nichts wird hochgeladen.
- **Schnell.** Native Aufnahme und ein kleiner Installer (etwa 4 MB unter Windows, 12 MB unter macOS).
- **Überall dieselbe App.** Windows, macOS und Linux bekommen denselben Editor, dieselben Tastenkürzel und Funktionen.

## Download

Lade den Installer für dein System aus dem [neuesten Release](https://github.com/tw4/lumela/releases/latest):

| System | Datei |
|---|---|
| Windows 10 / 11 (x64) | `Lumela_<version>_x64-setup.exe` oder `.msi` |
| macOS 10.15+ (Apple Silicon und Intel) | `Lumela_<version>_universal.dmg` |
| Linux (x64): Ubuntu 24.04+, Debian 13+, Fedora 40+ oder ähnlich | `Lumela_<version>_amd64.AppImage` oder `.deb` |

Oder installiere es mit einem Paketmanager:

```bash
brew trust tw4/tap && brew install --cask tw4/tap/lumela                             # macOS (Homebrew)
scoop install https://raw.githubusercontent.com/tw4/lumela/main/packaging/scoop/lumela.json   # Windows (Scoop)
```

Lumela sucht im Hintergrund nach neuen Versionen und bietet ein Update mit einem Klick an: herunterladen, Signatur prüfen, installieren, neu starten. Nichts muss deinstalliert oder erneut heruntergeladen werden. Unter Linux funktioniert das mit dem AppImage; beim `.deb` öffnet der Update-Button die Release-Seite.

> [!NOTE]
> Die Installer sind noch nicht code-signiert, deshalb warnt das Betriebssystem beim ersten Start.
>
> **Windows:** *Weitere Informationen* → *Trotzdem ausführen*.
>
> **macOS 15 und neuer:** Lumela einmal öffnen und die Warnung schließen, dann **Systemeinstellungen → Datenschutz & Sicherheit** öffnen, nach unten scrollen und neben der Lumela-Meldung auf **Dennoch öffnen** klicken. Unter macOS 14 und älter reicht Rechtsklick auf die App → *Öffnen*. Mit Homebrew entfällt dieser Schritt.
>
> **Linux:** Das `.deb` installiert `tesseract-ocr` für die Texterkennung. Beim AppImage bitte selbst installieren (`sudo apt install tesseract-ocr`, `sudo dnf install tesseract` oder `sudo pacman -S tesseract tesseract-data-eng`).

## Funktionen

| | |
|---|---|
| **Aufnahme** | Bereich, Fenster (<kbd>Leertaste</kbd> während der Aufnahme) oder Vollbild, mit globalen Tastenkürzeln und Tray-Menü. Mehrere Monitore. Öffnen aus Datei, Zwischenablage oder per Drag & Drop. |
| **Verschönern** | Automatischer Hintergrund aus den Randfarben des Screenshots, automatischer Ausgleich, Verläufe, Volltonfarben, eigenes Bild oder Desktop-Hintergrund, dazu Rand, Innenabstand, Eckenradius und Schatten. |
| **Formate** | Frei, 1:1, 4:3, 3:2, 16:9, 9:16 sowie Vorlagen für X/Twitter, Instagram, LinkedIn, Facebook und YouTube. |
| **Beschriften** | Pfeile (gerade, gebogen, doppelt, Linie), Text, Rechtecke, Ellipsen und Hervorhebungen. Verschieben, Größe ändern, Ebenenreihenfolge, Rückgängig/Wiederholen. |
| **Schwärzen** | Verpixeln, Weichzeichnen oder deckende Kästen. **Automatisch schwärzen** findet E-Mail-Adressen, Kreditkartennummern, IP-Adressen und API-Schlüssel mit einem Klick. |
| **Text kopieren** | Texterkennung auf dem Gerät: Wörter im Bild markieren und kopieren. |
| **Export** | Kopieren, speichern, als PNG/JPEG speichern oder direkt in eine andere App ziehen. Verlustfreie PNG-Komprimierung. Optionales Wasserzeichen. |
| **Organisieren** | Vorlagen, ein Verlauf früherer Screenshots mit ihren Bearbeitungen und anpassbare Tastenkürzel. |
| **Sprache der Oberfläche** | Englisch und Türkisch. [Füge deine hinzu!](CONTRIBUTING.md#translations) |

Tastenkürzel, Bauen aus dem Quellcode und Mitwirken findest du in der [englischen README](README.md).

## Datenschutz

Lumela hat keine Konten und keine Telemetrie. Screenshots, Verlauf und Einstellungen bleiben auf deinem Computer. Die einzige Netzwerkanfrage ist die Update-Prüfung gegen die Releases dieses Repositorys.

## Lizenz

Lumela ist freie Software: Du kannst sie unter den Bedingungen der [GNU General Public License v3.0](LICENSE) oder (nach deiner Wahl) einer späteren Version weitergeben und/oder verändern.
