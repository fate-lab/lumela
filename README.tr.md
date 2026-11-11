<p align="center">
  <img src="branding/lumela-icon.svg" width="112" height="112" alt="Lumela logo">
</p>

<h1 align="center">Lumela</h1>

<p align="center">
  <b>Windows, macOS ve Linux için CleanShot tarzı ekran görüntüleri.</b><br>
  Yakala, otomatik güzelleştir, not ekle ve paylaş. E-postalar, kart numaraları, IP adresleri ve API anahtarları otomatik bulanıklaştırılır.<br>
  Ücretsiz ve açık kaynak.
</p>

<p align="center">
  <a href="README.md">English</a> · Türkçe · <a href="README.de.md">Deutsch</a> · <a href="README.es.md">Español</a> · <a href="README.ru.md">Русский</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <img src="docs/demo.gif" alt="Lumela demosu" width="900">
</p>

## Neden Lumela?

Ham bir ekran görüntüsü paylaşmak için çoğu zaman yeterince iyi görünmez. Lumela onu tek adımda özenli bir görsele dönüştürür: uyumlu bir arka plan, dengeli kenar boşluğu, yuvarlatılmış köşeler ve yumuşak bir gölge. Oklar ve metinler anlatmak istediğinizi gösterir, hassas veriler ise kimse görmeden bulanıklaştırılır.

- **Her şey ücretsiz.** Hesap yok, abonelik yok, filigran yok.
- **Gizlilik odaklı.** Yakalama, metin tanıma ve gizleme cihazınızda çalışır. Hiçbir şey yüklenmez.
- **Hızlı.** Yerel yakalama ve küçük bir kurulum dosyası (Windows'ta yaklaşık 4 MB, macOS'ta 12 MB).
- **Her yerde aynı uygulama.** Windows, macOS ve Linux'ta aynı düzenleyici, kısayollar ve özellikler.

## İndir

Sisteminize uygun kurulum dosyasını [son sürümden](https://github.com/tw4/lumela/releases/latest) indirin:

| Sistem | Dosya |
|---|---|
| Windows 10 / 11 (x64) | `Lumela_<version>_x64-setup.exe` veya `.msi` |
| macOS 10.15+ (Apple silicon ve Intel) | `Lumela_<version>_universal.dmg` |
| Linux (x64): Ubuntu 24.04+, Debian 13+, Fedora 40+ veya benzeri | `Lumela_<version>_amd64.AppImage` veya `.deb` |

Ya da bir paket yöneticisiyle kurun:

```bash
brew trust tw4/tap && brew install --cask tw4/tap/lumela                             # macOS (Homebrew)
scoop install https://raw.githubusercontent.com/tw4/lumela/main/packaging/scoop/lumela.json   # Windows (Scoop)
```

Lumela yeni sürümleri arka planda kontrol eder ve tek tıkla güncelleme sunar: indirir, imzayı doğrular, kurar ve yeniden başlar. Kaldırıp yeniden indirmenize gerek kalmaz. Linux'ta bu AppImage ile çalışır; `.deb` ile güncelleme butonu sürüm sayfasını açar.

> [!NOTE]
> Kurulum dosyaları henüz kod imzalı değil, bu yüzden işletim sistemi ilk açılışta uyarı gösterir.
>
> **Windows:** *Ek bilgi* → *Yine de çalıştır*.
>
> **macOS 15 ve sonrası:** Lumela'yı bir kez açıp uyarıyı kapatın, ardından **Sistem Ayarları → Gizlilik ve Güvenlik** bölümüne gidin, aşağı kaydırın ve Lumela mesajının yanındaki **Yine de Aç**'a tıklayın. macOS 14 ve öncesinde uygulamaya sağ tıklayıp *Aç* demek yeterlidir. Homebrew ile kurarsanız bu adım gerekmez.
>
> **Linux:** `.deb`, metin tanıma için `tesseract-ocr`'ı kurar. AppImage ile kendiniz kurun (`sudo apt install tesseract-ocr`, `sudo dnf install tesseract` veya `sudo pacman -S tesseract tesseract-data-eng`).

## Özellikler

| | |
|---|---|
| **Yakalama** | Alan, pencere (yakalarken <kbd>Space</kbd>) veya tam ekran; genel kısayollar ve tepsi menüsü. Çoklu monitör. Dosyadan, panodan veya sürükle-bırak ile açma. |
| **Güzelleştirme** | Ekran görüntüsünün kenar renklerinden otomatik arka plan, otomatik denge, gradyanlar, düz renkler, kendi görseliniz veya masaüstü duvar kâğıdı; kenar boşluğu, iç boşluk, köşe yuvarlama ve gölge. |
| **Boyutlar** | Serbest, 1:1, 4:3, 3:2, 16:9, 9:16 ve X/Twitter, Instagram, LinkedIn, Facebook, YouTube hazır ayarları. |
| **Not ekleme** | Oklar (düz, eğri, çift yönlü, çizgi), metin, dikdörtgen, elips ve vurgulama. Taşıma, boyutlandırma, katman sırası ve geri al/yinele. |
| **Gizleme** | Pikselleştirme, bulanıklaştırma veya düz kutular. **Otomatik gizleme** e-postaları, kredi kartı numaralarını, IP adreslerini ve API anahtarlarını tek tıkla bulur. |
| **Metin kopyalama** | Cihaz üzerinde metin tanıma: görüntüdeki kelimeleri seçip kopyalayın. |
| **Dışa aktarma** | Kopyala, kaydet, PNG/JPEG olarak farklı kaydet veya doğrudan başka bir uygulamaya sürükle. Kayıpsız PNG sıkıştırma. İsteğe bağlı filigran. |
| **Düzen** | Hazır ayarlar, düzenlemeleriyle birlikte geçmiş ekran görüntüleri ve ayarlanabilir kısayollar. |
| **Arayüz dili** | İngilizce ve Türkçe. [Kendi dilinizi ekleyin!](CONTRIBUTING.md#translations) |

Klavye kısayolları, kaynaktan derleme ve katkıda bulunma için [İngilizce README](README.md)'ye bakın.

## Gizlilik

Lumela'da hesap ve telemetri yoktur. Ekran görüntüleri, geçmiş ve ayarlar bilgisayarınızda kalır. Tek ağ isteği, bu deponun sürümlerine yapılan güncelleme kontrolüdür.

## Lisans

Lumela özgür yazılımdır: [GNU Genel Kamu Lisansı v3.0](LICENSE) veya (tercihinize göre) daha sonraki herhangi bir sürümün koşulları altında yeniden dağıtabilir ve/veya değiştirebilirsiniz.
