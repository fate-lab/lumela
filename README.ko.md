<p align="center">
  <img src="branding/lumela-icon.svg" width="112" height="112" alt="Lumela logo">
</p>

<h1 align="center">Lumela</h1>

<p align="center">
  <b>Windows, macOS, Linux용 CleanShot 스타일 스크린샷 도구.</b><br>
  캡처하고, 자동으로 꾸미고, 주석을 달아 공유하세요. 이메일, 카드 번호, IP 주소, API 키는 자동으로 흐리게 처리됩니다.<br>
  무료 오픈 소스.
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · 한국어
</p>

<p align="center">
  <img src="docs/demo.gif" alt="Lumela 데모" width="900">
</p>

## 왜 Lumela인가요?

막 찍은 스크린샷은 그대로 공유하기에 보기 좋지 않은 경우가 많습니다. Lumela는 한 번에 깔끔한 이미지로 만들어 줍니다. 어울리는 배경, 균형 잡힌 여백, 둥근 모서리, 부드러운 그림자. 화살표와 텍스트로 설명을 더하고, 민감한 정보는 누가 보기 전에 흐리게 처리됩니다.

- **모두 무료.** 계정, 구독, 워터마크가 없습니다.
- **프라이버시 우선.** 캡처, 텍스트 인식, 가리기는 모두 기기에서 처리되며 아무것도 업로드되지 않습니다.
- **가볍고 빠름.** 네이티브 캡처와 작은 설치 파일(Windows 약 4 MB, macOS 약 12 MB).
- **어디서나 같은 앱.** Windows, macOS, Linux에서 같은 편집기, 단축키, 기능을 제공합니다.

## 다운로드

[최신 릴리스](https://github.com/tw4/lumela/releases/latest)에서 사용 중인 시스템용 설치 파일을 받으세요.

| 시스템 | 파일 |
|---|---|
| Windows 10 / 11 (x64) | `Lumela_<version>_x64-setup.exe` 또는 `.msi` |
| macOS 10.15+ (Apple 실리콘 및 Intel) | `Lumela_<version>_universal.dmg` |
| Linux (x64): Ubuntu 24.04+, Debian 13+, Fedora 40+ 등 | `Lumela_<version>_amd64.AppImage` 또는 `.deb` |

패키지 관리자로도 설치할 수 있습니다.

```bash
brew trust tw4/tap && brew install --cask tw4/tap/lumela                             # macOS (Homebrew)
scoop install https://raw.githubusercontent.com/tw4/lumela/main/packaging/scoop/lumela.json   # Windows (Scoop)
```

Lumela는 스스로 업데이트되며, 모든 업데이트는 설치 전에 서명을 확인합니다.

> [!NOTE]
> 설치 파일에 아직 코드 서명이 되어 있지 않아 처음 실행할 때 운영체제가 경고를 표시합니다.
>
> **Windows:** *추가 정보* → *실행*.
>
> **macOS 15 이상:** Lumela를 한 번 열고 경고를 닫은 뒤 **시스템 설정 → 개인정보 보호 및 보안**으로 가서 아래로 스크롤하고, Lumela 메시지 옆의 **그래도 열기**를 클릭하세요. macOS 14 이하에서는 앱을 오른쪽 클릭 → *열기*로 충분합니다. Homebrew로 설치하면 이 단계가 필요 없습니다.
>
> **Linux:** `.deb`는 텍스트 인식을 위해 `tesseract-ocr`을 설치합니다. AppImage를 사용할 때는 직접 설치하세요(`sudo apt install tesseract-ocr`, `sudo dnf install tesseract` 또는 `sudo pacman -S tesseract tesseract-data-eng`).

## 기능

| | |
|---|---|
| **캡처** | 영역, 창(캡처 중 <kbd>Space</kbd>), 전체 화면. 전역 단축키와 트레이 메뉴, 멀티 모니터 지원. 파일, 클립보드, 드래그 앤 드롭으로도 열 수 있습니다. |
| **꾸미기** | 스크린샷 가장자리 색으로 배경 자동 생성, 자동 균형, 그라데이션, 단색, 내 이미지나 바탕화면 배경, 여백, 인셋, 둥근 모서리, 그림자. |
| **크기** | 자유, 1:1, 4:3, 3:2, 16:9, 9:16, X/Twitter, Instagram, LinkedIn, Facebook, YouTube 프리셋. |
| **주석** | 화살표(직선, 곡선, 양방향, 선), 텍스트, 사각형, 타원, 강조. 이동, 크기 조절, 레이어 순서, 실행 취소/다시 실행. |
| **가리기** | 모자이크, 흐림, 단색 상자. **자동 가리기**로 이메일, 카드 번호, IP 주소, API 키를 한 번에 찾습니다. |
| **텍스트 복사** | 기기 내 텍스트 인식: 이미지에서 글자를 선택해 복사. |
| **내보내기** | 복사, 저장, PNG/JPEG로 다른 이름 저장, 다른 앱으로 바로 드래그. 무손실 PNG 압축. 워터마크는 선택 사항. |
| **정리** | 프리셋, 편집 내역이 담긴 기록, 사용자 지정 단축키. |
| **표시 언어** | 영어와 터키어. [여러분의 언어를 추가해 주세요!](CONTRIBUTING.md#translations) |

키보드 단축키, 소스에서 빌드하기, 기여 방법은 [영어 README](README.md)를 참고하세요.

## 개인정보

Lumela에는 계정도 텔레메트리도 없습니다. 스크린샷, 기록, 설정은 내 컴퓨터에만 저장됩니다. 유일한 네트워크 요청은 이 저장소의 릴리스로 업데이트를 확인하는 것입니다.

## 라이선스

Lumela는 자유 소프트웨어입니다. [GNU General Public License v3.0](LICENSE) 또는 (선택에 따라) 그 이후 버전의 조건에 따라 재배포 및 수정할 수 있습니다.
