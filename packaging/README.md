# Packaging

Manifests for package managers. Each one points at the installers on the GitHub release, so after a release only the version and checksums change.

| Manager | File | Where it is published |
|---|---|---|
| Homebrew | `homebrew/lumela.rb` | `Casks/lumela.rb` in the [tw4/homebrew-tap](https://github.com/tw4/homebrew-tap) repository |
| Scoop | `scoop/lumela.json` | Installable straight from this repository (see the main README) |
| winget | `winget/<version>/` | Pull request to [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs) under `manifests/t/tw4/Lumela/<version>/` |
| AUR | `aur/PKGBUILD` | Not published yet. Want to maintain `lumela-bin` on the AUR? Use this PKGBUILD (`makepkg --printsrcinfo > .SRCINFO`) and open an issue so we can link it. |

Checksums: `shasum -a 256 <file>` (winget expects them in upper case).
