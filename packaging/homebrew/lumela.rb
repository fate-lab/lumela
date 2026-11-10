cask "lumela" do
  version "0.1.1"
  sha256 "78d2af9f453b98dbf6f895578156b7d1994deb761a22f697b75ebfdf2068e186"

  url "https://github.com/tw4/lumela/releases/download/v#{version}/Lumela_#{version}_universal.dmg"
  name "Lumela"
  desc "Screenshot tool: capture, beautify, annotate, redact and copy text"
  homepage "https://github.com/tw4/lumela"

  livecheck do
    url :url
    strategy :github_latest
  end

  auto_updates true

  app "Lumela.app"

  # The app is not notarized yet; without this macOS refuses to open it.
  postflight do
    system_command "/usr/bin/xattr", args: ["-dr", "com.apple.quarantine", "#{appdir}/Lumela.app"]
  end

  zap trash: [
    "~/Library/Application Support/app.lumela.desktop",
    "~/Library/Caches/app.lumela.desktop",
    "~/Library/Preferences/app.lumela.desktop.plist",
    "~/Library/WebKit/app.lumela.desktop",
  ]
end
