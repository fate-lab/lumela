<p align="center">
  <img src="branding/lumela-icon.svg" width="112" height="112" alt="Lumela logo">
</p>

<h1 align="center">Lumela</h1>

<p align="center">
  <b>Windows・macOS・Linux 向けの CleanShot スタイルのスクリーンショットツール。</b><br>
  キャプチャ、自動で美しく整え、注釈を付けて共有。メールアドレス、カード番号、IP アドレス、API キーは自動でぼかされます。<br>
  無料のオープンソース。
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.tr.md">Türkçe</a> · <a href="README.de.md">Deutsch</a> · <a href="README.es.md">Español</a> · <a href="README.ru.md">Русский</a> · <a href="README.zh-CN.md">简体中文</a> · 日本語 · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <img src="docs/demo.gif" alt="Lumela のデモ" width="900">
</p>

## なぜ Lumela？

撮ったままのスクリーンショットは、そのまま共有するには見栄えがよくありません。Lumela はワンステップで整った画像にします。周囲に合った背景、バランスのよい余白、角丸、やわらかい影。矢印とテキストで説明でき、機密データは誰かに見られる前にぼかされます。

- **すべて無料。** アカウント不要、サブスクリプションなし、透かしなし。
- **プライバシー重視。** キャプチャ、文字認識、マスキングはすべて端末上で行われ、何もアップロードされません。
- **軽快。** ネイティブキャプチャと小さなインストーラー（Windows 約 4 MB、macOS 約 12 MB）。
- **どこでも同じアプリ。** Windows、macOS、Linux で同じエディター、ショートカット、機能を使えます。

## ダウンロード

[最新リリース](https://github.com/tw4/lumela/releases/latest) からお使いのシステム用のインストーラーを入手してください。

| システム | ファイル |
|---|---|
| Windows 10 / 11 (x64) | `Lumela_<version>_x64-setup.exe` または `.msi` |
| macOS 10.15+（Apple シリコンと Intel） | `Lumela_<version>_universal.dmg` |
| Linux (x64)：Ubuntu 24.04+、Debian 13+、Fedora 40+ など | `Lumela_<version>_amd64.AppImage` または `.deb` |

パッケージマネージャーでもインストールできます。

```bash
brew trust tw4/tap && brew install --cask tw4/tap/lumela                             # macOS (Homebrew)
scoop install https://raw.githubusercontent.com/tw4/lumela/main/packaging/scoop/lumela.json   # Windows (Scoop)
```

Lumela は自動でアップデートされ、すべてのアップデートはインストール前に署名が検証されます。

> [!NOTE]
> インストーラーはまだコード署名されていないため、初回起動時に OS が警告を表示します。
>
> **Windows：** *詳細情報* → *実行*。
>
> **macOS 15 以降：** Lumela を一度開いて警告を閉じ、**システム設定 → プライバシーとセキュリティ** を開いて下にスクロールし、Lumela のメッセージの横にある **このまま開く** をクリックします。macOS 14 以前はアプリを右クリック → *開く* で十分です。Homebrew でインストールした場合、この手順は不要です。
>
> **Linux：** `.deb` は文字認識用に `tesseract-ocr` をインストールします。AppImage の場合はご自身でインストールしてください（`sudo apt install tesseract-ocr`、`sudo dnf install tesseract` または `sudo pacman -S tesseract tesseract-data-eng`）。

## 機能

| | |
|---|---|
| **キャプチャ** | 範囲、ウィンドウ（キャプチャ中に <kbd>Space</kbd>）、全画面。グローバルショートカットとトレイメニュー、マルチモニター対応。ファイル、クリップボード、ドラッグ＆ドロップからも開けます。 |
| **美しく整える** | スクリーンショットの端の色から背景を自動生成、自動バランス、グラデーション、単色、自分の画像やデスクトップの壁紙、余白、インセット、角丸、影。 |
| **サイズ** | フリー、1:1、4:3、3:2、16:9、9:16、X/Twitter・Instagram・LinkedIn・Facebook・YouTube 用プリセット。 |
| **注釈** | 矢印（直線、曲線、両方向、線）、テキスト、四角形、楕円、ハイライト。移動、リサイズ、重なり順、元に戻す/やり直し。 |
| **マスキング** | ピクセル化、ぼかし、塗りつぶし。**自動マスキング** でメールアドレス、カード番号、IP アドレス、API キーをワンクリックで検出。 |
| **テキストのコピー** | 端末上の文字認識：画像上の文字を選択してコピー。 |
| **書き出し** | コピー、保存、PNG/JPEG で名前を付けて保存、ほかのアプリへ直接ドラッグ。ロスレス PNG 圧縮。透かしはオプション。 |
| **整理** | プリセット、編集内容付きの履歴、カスタマイズ可能なショートカット。 |
| **表示言語** | 英語とトルコ語。[あなたの言語を追加してください！](CONTRIBUTING.md#translations) |

キーボードショートカット、ソースからのビルド、コントリビュートについては [英語の README](README.md) をご覧ください。

## プライバシー

Lumela にはアカウントもテレメトリもありません。スクリーンショット、履歴、設定はお使いのコンピューターに保存されます。唯一のネットワーク通信は、このリポジトリのリリースに対するアップデート確認です。

## ライセンス

Lumela はフリーソフトウェアです。[GNU General Public License v3.0](LICENSE) または（任意で）それ以降のバージョンの条件のもとで再配布や改変ができます。
