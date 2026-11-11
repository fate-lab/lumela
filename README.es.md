<p align="center">
  <img src="branding/lumela-icon.svg" width="112" height="112" alt="Lumela logo">
</p>

<h1 align="center">Lumela</h1>

<p align="center">
  <b>Capturas de pantalla al estilo CleanShot para Windows, macOS y Linux.</b><br>
  Captura, embellece automáticamente, anota y comparte. Los correos, números de tarjeta, direcciones IP y claves de API se difuminan automáticamente.<br>
  Gratis y de código abierto.
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.tr.md">Türkçe</a> · <a href="README.de.md">Deutsch</a> · Español · <a href="README.ru.md">Русский</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <img src="docs/demo.gif" alt="Demo de Lumela" width="900">
</p>

## ¿Por qué Lumela?

Una captura sin editar rara vez se ve lo bastante bien para compartirla. Lumela la convierte en una imagen cuidada en un solo paso: un fondo a juego, márgenes equilibrados, esquinas redondeadas y una sombra suave. Las flechas y el texto la explican, y los datos sensibles se difuminan antes de que nadie los vea.

- **Todo es gratis.** Sin cuentas, sin suscripciones, sin marcas de agua.
- **Privacidad ante todo.** La captura, el reconocimiento de texto y el ocultado se hacen en tu dispositivo. No se sube nada.
- **Rápido.** Captura nativa y un instalador pequeño (unos 4 MB en Windows, 12 MB en macOS).
- **La misma app en todas partes.** Windows, macOS y Linux tienen el mismo editor, atajos y funciones.

## Descarga

Descarga el instalador para tu sistema desde la [última versión](https://github.com/tw4/lumela/releases/latest):

| Sistema | Archivo |
|---|---|
| Windows 10 / 11 (x64) | `Lumela_<version>_x64-setup.exe` o `.msi` |
| macOS 10.15+ (Apple silicon e Intel) | `Lumela_<version>_universal.dmg` |
| Linux (x64): Ubuntu 24.04+, Debian 13+, Fedora 40+ o similar | `Lumela_<version>_amd64.AppImage` o `.deb` |

O instálalo con un gestor de paquetes:

```bash
brew trust tw4/tap && brew install --cask tw4/tap/lumela                             # macOS (Homebrew)
scoop install https://raw.githubusercontent.com/tw4/lumela/main/packaging/scoop/lumela.json   # Windows (Scoop)
```

Lumela busca nuevas versiones en segundo plano y ofrece actualizar con un clic: descarga, comprueba la firma, instala y se reinicia, sin desinstalar ni volver a descargar nada. En Linux funciona con el AppImage; con el `.deb`, el botón de actualizar abre la página de la versión.

> [!NOTE]
> Los instaladores aún no están firmados, así que el sistema operativo muestra un aviso la primera vez.
>
> **Windows:** *Más información* → *Ejecutar de todas formas*.
>
> **macOS 15 y posteriores:** abre Lumela una vez y cierra el aviso, luego ve a **Ajustes del Sistema → Privacidad y seguridad**, desplázate hacia abajo y haz clic en **Abrir igualmente** junto al mensaje de Lumela. En macOS 14 y anteriores basta con clic derecho en la app → *Abrir*. Si lo instalas con Homebrew, no hace falta este paso.
>
> **Linux:** el `.deb` instala `tesseract-ocr` para el reconocimiento de texto. Con el AppImage, instálalo tú (`sudo apt install tesseract-ocr`, `sudo dnf install tesseract` o `sudo pacman -S tesseract tesseract-data-eng`).

## Funciones

| | |
|---|---|
| **Captura** | Área, ventana (pulsa <kbd>Espacio</kbd> al capturar) o pantalla completa, con atajos globales y menú en la bandeja. Varios monitores. Abre desde un archivo, el portapapeles o arrastrando. |
| **Embellecer** | Fondo automático a partir de los colores del borde, equilibrio automático, degradados, colores sólidos, tu propia imagen o el fondo de escritorio, y margen, relleno, radio de esquinas y sombra. |
| **Tamaños** | Libre, 1:1, 4:3, 3:2, 16:9, 9:16 y ajustes para X/Twitter, Instagram, LinkedIn, Facebook y YouTube. |
| **Anotar** | Flechas (rectas, curvas, dobles, línea), texto, rectángulos, elipses y resaltados. Mover, redimensionar, orden de capas y deshacer/rehacer. |
| **Ocultar** | Pixelar, difuminar o cuadros sólidos. **Ocultado automático** encuentra correos, números de tarjeta de crédito, direcciones IP y claves de API con un clic. |
| **Copiar texto** | Reconocimiento de texto en el dispositivo: selecciona palabras en la imagen y cópialas. |
| **Exportar** | Copiar, guardar, guardar como PNG/JPEG o arrastrar directamente a otra app. Compresión PNG sin pérdida. Marca de agua opcional. |
| **Organizar** | Ajustes guardados, un historial de capturas con sus ediciones y atajos configurables. |
| **Idioma de la interfaz** | Inglés y turco. [¡Añade el tuyo!](CONTRIBUTING.md#translations) |

Para los atajos de teclado, compilar desde el código fuente y contribuir, consulta el [README en inglés](README.md).

## Privacidad

Lumela no tiene cuentas ni telemetría. Las capturas, el historial y los ajustes se quedan en tu ordenador. La única petición de red es la comprobación de actualizaciones contra las versiones de este repositorio.

## Licencia

Lumela es software libre: puedes redistribuirlo y/o modificarlo según los términos de la [Licencia Pública General de GNU v3.0](LICENSE) o (a tu elección) cualquier versión posterior.
