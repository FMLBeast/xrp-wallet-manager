# Build Status & Downloads

Add these badges to your main README.md to show build status and provide download links:

## 🏷️ Status Badges

```markdown
[![Build & Release](https://github.com/YOURUSERNAME/xrp_wallet_manager/actions/workflows/build-release.yml/badge.svg)](https://github.com/YOURUSERNAME/xrp_wallet_manager/actions/workflows/build-release.yml)
[![PR Build & Test](https://github.com/YOURUSERNAME/xrp_wallet_manager/actions/workflows/pr-build.yml/badge.svg)](https://github.com/YOURUSERNAME/xrp_wallet_manager/actions/workflows/pr-build.yml)
[![Code Signing](https://github.com/YOURUSERNAME/xrp_wallet_manager/actions/workflows/code-signing.yml/badge.svg)](https://github.com/YOURUSERNAME/xrp_wallet_manager/actions/workflows/code-signing.yml)

[![GitHub release (latest by date)](https://img.shields.io/github/v/release/YOURUSERNAME/xrp_wallet_manager)](https://github.com/YOURUSERNAME/xrp_wallet_manager/releases/latest)
[![GitHub downloads](https://img.shields.io/github/downloads/YOURUSERNAME/xrp_wallet_manager/total)](https://github.com/YOURUSERNAME/xrp_wallet_manager/releases)
[![License](https://img.shields.io/github/license/YOURUSERNAME/xrp_wallet_manager)](LICENSE)
```

## 📦 Download Section Template

```markdown
## 📦 Download

### Latest Release

[![Download Latest](https://img.shields.io/badge/Download-Latest%20Release-blue?style=for-the-badge)](https://github.com/YOURUSERNAME/xrp_wallet_manager/releases/latest)

### Platform-Specific Downloads

| Platform | Download | Size | Checksum |
|----------|----------|------|----------|
| **Windows** | [Setup.exe](https://github.com/YOURUSERNAME/xrp_wallet_manager/releases/latest/download/XRP-Wallet-Manager-Setup.exe) | ~85 MB | [checksums](https://github.com/YOURUSERNAME/xrp_wallet_manager/releases/latest/download/checksums-windows.txt) |
| **macOS** | [.dmg](https://github.com/YOURUSERNAME/xrp_wallet_manager/releases/latest/download/XRP-Wallet-Manager.dmg) | ~90 MB | [checksums](https://github.com/YOURUSERNAME/xrp_wallet_manager/releases/latest/download/checksums-mac.txt) |
| **Linux** | [.deb](https://github.com/YOURUSERNAME/xrp_wallet_manager/releases/latest/download/xrp-wallet-manager.deb) | ~80 MB | [checksums](https://github.com/YOURUSERNAME/xrp_wallet_manager/releases/latest/download/checksums-linux.txt) |
| **Linux** | [.AppImage](https://github.com/YOURUSERNAME/xrp_wallet_manager/releases/latest/download/XRP-Wallet-Manager.AppImage) | ~80 MB | [checksums](https://github.com/YOURUSERNAME/xrp_wallet_manager/releases/latest/download/checksums-linux.txt) |

### Installation Instructions

#### Windows
1. Download `XRP-Wallet-Manager-Setup.exe`
2. Run the installer as Administrator
3. Follow the installation wizard
4. Launch from Start Menu or Desktop shortcut

#### macOS
1. Download `XRP-Wallet-Manager.dmg`
2. Open the .dmg file
3. Drag "XRP Wallet Manager" to Applications folder
4. Launch from Applications or Launchpad
5. If blocked by Gatekeeper: System Preferences → Security & Privacy → Allow

#### Linux (Debian/Ubuntu)
```bash
# Download and install .deb package
wget https://github.com/YOURUSERNAME/xrp_wallet_manager/releases/latest/download/xrp-wallet-manager.deb
sudo dpkg -i xrp-wallet-manager.deb
sudo apt-get install -f  # Fix any dependency issues

# Launch
xrp-wallet-manager
```

#### Linux (AppImage)
```bash
# Download AppImage
wget https://github.com/YOURUSERNAME/xrp_wallet_manager/releases/latest/download/XRP-Wallet-Manager.AppImage

# Make executable and run
chmod +x XRP-Wallet-Manager.AppImage
./XRP-Wallet-Manager.AppImage
```

### Verification

To verify the integrity of your download:

```bash
# Download checksums
curl -L https://github.com/YOURUSERNAME/xrp_wallet_manager/releases/latest/download/checksums-linux.txt -o checksums.txt

# Verify (Linux example)
sha256sum -c checksums.txt
```
```

## 🔄 Auto-Update Section

```markdown
## 🔄 Updates

XRP Wallet Manager includes automatic update checking:

- **Automatic**: App checks for updates on startup
- **Manual**: Help → Check for Updates
- **Notifications**: Desktop notifications for new versions

### Update Process
1. App detects new version
2. Shows update notification
3. Downloads update in background
4. Prompts to restart and install
5. Automatic backup of current version

### Release Channels
- **Stable**: Tested releases (recommended)
- **Beta**: Pre-release versions with latest features
- **Alpha**: Development builds (not recommended for production)
```

## 🛡️ Security Section

```markdown
## 🛡️ Security & Trust

### Code Signing
All releases are cryptographically signed:

- **Windows**: Authenticode signature
- **macOS**: Apple Developer ID + Notarization
- **Linux**: SHA256 checksums

### Verification Commands

**Windows (PowerShell):**
```powershell
Get-AuthenticodeSignature "XRP Wallet Manager Setup.exe"
```

**macOS:**
```bash
codesign -v --verbose=4 "/Applications/XRP Wallet Manager.app"
spctl -a -v "/Applications/XRP Wallet Manager.app"
```

**Linux:**
```bash
sha256sum -c checksums-linux.txt
```

### Build Transparency
- All builds created via GitHub Actions
- Source code → Binary mapping in release notes
- Build logs publicly available
- Reproducible builds (deterministic)
```

## 📊 Analytics Section

```markdown
## 📊 Download Statistics

[![Downloads](https://img.shields.io/github/downloads/YOURUSERNAME/xrp_wallet_manager/total?style=social)](https://github.com/YOURUSERNAME/xrp_wallet_manager/releases)

| Version | Downloads | Release Date |
|---------|-----------|--------------|
| Latest | ![](https://img.shields.io/github/downloads/YOURUSERNAME/xrp_wallet_manager/latest/total) | ![](https://img.shields.io/github/release-date/YOURUSERNAME/xrp_wallet_manager) |

View detailed analytics in the [Releases](https://github.com/YOURUSERNAME/xrp_wallet_manager/releases) section.
```

---

**Remember to replace `YOURUSERNAME` with your actual GitHub username!**