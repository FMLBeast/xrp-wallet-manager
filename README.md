# XRP Wallet Manager

<div align="center">

**A secure, professional XRP Ledger wallet built with Electron and React**

[![Build & Release](https://github.com/FMLBeast/xrp-wallet-manager/actions/workflows/build-release.yml/badge.svg)](https://github.com/FMLBeast/xrp-wallet-manager/actions/workflows/build-release.yml)
[![PR Build & Test](https://github.com/FMLBeast/xrp-wallet-manager/actions/workflows/pr-build.yml/badge.svg)](https://github.com/FMLBeast/xrp-wallet-manager/actions/workflows/pr-build.yml)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/FMLBeast/xrp-wallet-manager)](https://github.com/FMLBeast/xrp-wallet-manager/releases/latest)

![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![License](https://img.shields.io/badge/license-MIT-green)
[![GitHub downloads](https://img.shields.io/github/downloads/FMLBeast/xrp-wallet-manager/total)](https://github.com/FMLBeast/xrp-wallet-manager/releases)

</div>

## 📦 Download

[![Download Latest](https://img.shields.io/badge/Download-Latest%20Release-blue?style=for-the-badge)](https://github.com/FMLBeast/xrp-wallet-manager/releases/latest)

| Platform | Download | Notes |
|----------|----------|-------|
| **Windows** | [Setup.exe](https://github.com/FMLBeast/xrp-wallet-manager/releases/latest) | Installer + Portable |
| **macOS** | [.dmg](https://github.com/FMLBeast/xrp-wallet-manager/releases/latest) | Universal (Intel + Apple Silicon) |
| **Linux** | [.deb](https://github.com/FMLBeast/xrp-wallet-manager/releases/latest) / [.AppImage](https://github.com/FMLBeast/xrp-wallet-manager/releases/latest) | Ubuntu/Debian + Universal |

## ✨ Features

### 🏦 Advanced Wallet Management
- **Multi-Wallet Support**: Manage unlimited XRP wallets with professional UI
- **Drag & Drop Ordering**: Customize wallet order with persistence across restarts
- **Import Options**: Family seeds, private keys, mnemonic phrases, ED25519 seeds
- **Test Wallet Generation**: One-click testnet wallets with automatic funding
- **Network Switching**: Support for Mainnet, Testnet, and Devnet
- **Smart Address Book**: Save frequently used addresses with tags

### 🛡️ Enterprise-Grade Security
- **Master Password Protection**: AES-CTR encryption with PBKDF2-SHA256 (390,000 iterations)
- **Hardware-Grade Encryption**: All private keys encrypted and stored locally
- **Context Isolation**: Electron security best practices with sandboxing
- **Backup/Restore**: Export and restore encrypted wallet data
- **Zero Network Exposure**: Private keys never transmitted over network

### 🔐 Multi-Signature Wallets
- **Complete MultiSig System**: Professional 3-step setup wizard
- **Reserve Management**: Clear display of 0.2 XRP reserve requirements
- **Safety Checks**: Master key removal only when properly configured
- **Smart Notifications**: Visual alerts for pending signature requirements
- **Fault Tolerance**: Prevents all-signer-required configurations

### 💸 Professional Transactions
- **Enhanced Send Interface**: Fee calculation, validation, and confirmations
- **QR Code Generation**: Easy address sharing with customizable QR codes
- **Complete Transaction History**: Advanced filtering and search capabilities
- **Destination Tag Support**: Full memo and tag functionality
- **Real-time Updates**: Live balance and transaction monitoring

### 🎨 Modern User Experience
- **Material Design**: Beautiful dark theme with professional styling
- **Native Desktop App**: Full Electron integration with OS-specific features
- **Keyboard Shortcuts**: Complete menu system with hotkeys
- **Responsive Design**: Optimized for all screen sizes
- **Network Explorer**: Direct links to XRPL block explorers
- **Loading States**: Smart progress indicators for all operations

## 🚀 Quick Start

### For Users (Recommended)

1. **Download** the latest release for your platform
2. **Install** and launch XRP Wallet Manager
3. **Create** a master password when prompted
4. **Import** your existing wallets or generate test wallets

### For Developers

```bash
# Clone the repository
git clone https://github.com/FMLBeast/xrp-wallet-manager.git
cd xrp_wallet_manager

# Install dependencies
npm install

# Start in development mode (Electron + React)
npm run electron-dev
```

## 🛠️ Development

### Prerequisites
- Node.js 18 or higher
- npm or yarn

### Available Scripts

```bash
# Development
npm run electron-dev     # Start Electron app with hot reload
npm start               # Start React dev server only (web version)

# Testing
npm test               # Run unit tests
npm run lint          # Run ESLint
npm run e2e           # Run end-to-end tests

# Building
npm run build         # Build React app for production
npm run dist          # Create platform-specific distributables
npm run dist-all      # Build for all platforms (macOS only)
```

### Project Structure

```
xrp-wallet-manager/
├── .github/
│   └── workflows/        # GitHub Actions CI/CD
│       ├── build-release.yml
│       ├── pr-build.yml
│       └── code-signing.yml
├── src/
│   ├── components/       # React UI components
│   │   ├── WalletTabs.js
│   │   ├── MasterPasswordDialog.js
│   │   ├── ImportWalletDialog.js
│   │   ├── TransactionHistory.js
│   │   ├── QRCodeDisplay.js
│   │   ├── MultiSigTab.js     # Complete MultiSig system
│   │   └── AddressBookTab.js
│   ├── utils/            # Core utilities
│   │   ├── encryption.js      # AES-CTR encryption
│   │   ├── walletStorage.js   # Encrypted persistence
│   │   ├── xrplWallet.js      # XRPL integration
│   │   └── keyCache.js        # Performance optimization
│   └── App.js            # Main React component with drag & drop
├── public/               # Static assets
├── assets/               # App icons (all platforms)
├── main.js              # Electron main process
├── preload.js           # Electron preload script (secure IPC)
├── craco.config.js      # Webpack configuration
└── package.json         # Dependencies and build config
```

## 🏗️ Building & Distribution

### Automated Builds (GitHub Actions)

Every push to main automatically:
- ✅ Runs tests and linting
- ✅ Builds for Windows, macOS, and Linux
- ✅ Creates signed distributables
- ✅ Uploads artifacts for download

### Manual Building

```bash
# Build for current platform
npm run dist

# Output locations:
# macOS: dist-electron/*.dmg, *.zip
# Windows: dist-electron/*.exe, *.msi
# Linux: dist-electron/*.deb, *.AppImage, *.rpm
```

### Code Signing

Production releases are automatically signed:
- **macOS**: Apple Developer ID + Notarization
- **Windows**: Authenticode signatures
- **Linux**: SHA256 checksums for verification

See [`.github/CODE_SIGNING.md`](.github/CODE_SIGNING.md) for setup details.

## 📖 User Guide

### First Launch

1. **Master Password Creation**
   - Minimum 12 characters with mixed case, numbers, symbols
   - Encrypts all wallet data locally
   - ⚠️ **Cannot be recovered if lost!**

2. **Wallet Management**
   - Import existing wallets (File → Import Wallet)
   - Generate test wallets for development
   - Use drag & drop to reorder wallets (lock icon to enable)

### Multi-Signature Wallets

1. **Setup Process**
   - Step 1: Configure signers and quorum
   - Step 2: Review reserve requirements (0.2 XRP)
   - Step 3: Confirm and deploy to ledger

2. **Safety Features**
   - Master key removal only when MultiSig is secure
   - Minimum 2 signers with fault tolerance validation
   - Real-time signature progress tracking

### Keyboard Shortcuts

- `Cmd/Ctrl+N` - Import/Create Wallet
- `Cmd/Ctrl+I` - Import Wallet
- `Cmd/Ctrl+S` - Send Transaction
- `Cmd/Ctrl+R` - Receive Tab
- `Cmd/Ctrl+F5` - Refresh Balance

## 🔒 Security

### Encryption Specifications

- **Algorithm**: AES-CTR stream cipher
- **Key Derivation**: PBKDF2-SHA256 (390,000 iterations)
- **Integrity**: HMAC-SHA256 authentication
- **Salt**: 256-bit random salt per encryption

### Storage Locations

- **macOS**: `~/Library/Application Support/xrp-wallet-manager/`
- **Windows**: `%APPDATA%/xrp-wallet-manager/`
- **Linux**: `~/.config/xrp-wallet-manager/`

### Best Practices

1. **Strong Master Password** - Use a password manager
2. **Regular Backups** - Export wallet data frequently
3. **Verify Downloads** - Check signatures and checksums
4. **Test First** - Always test with small amounts on testnet

## 🧪 Testing

### Unit Tests
```bash
npm test -- --coverage --watchAll=false
```

### End-to-End Tests
```bash
npm run e2e              # Headless mode
npm run e2e:ui           # Interactive mode
npm run e2e:headed       # Browser visible
```

### Manual Testing
- Use testnet for safe testing
- Generate test wallets with automatic funding
- Verify all transaction types before mainnet use

## 🐛 Troubleshooting

### Common Issues

**App Won't Launch**
- Verify Node.js 18+ is installed
- Clear cache: `rm -rf node_modules && npm install`
- Check for port conflicts on 3000

**Invalid Master Password**
- Ensure no extra spaces when typing
- Try password manager copy/paste
- Reset: Delete encrypted file and restart (⚠️ loses wallets)

**Build Errors**
- Generate icons: `cd assets && ./generate-icons.sh`
- Clear build cache: `rm -rf build dist-electron`
- For macOS signing issues: `CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist`

**MultiSig Issues**
- Ensure sufficient XRP balance (minimum 0.2 XRP reserve)
- Verify all signer addresses are valid
- Check network connectivity for transaction submission

## 🚀 Deployment

### Desktop Shortcuts

Pre-built shortcuts for easy launching:
- **XRP Wallet Manager.command** - macOS Terminal launcher
- **setup-xrp-alias.sh** - Creates `xrp` terminal command
- Multiple app bundles available on Desktop

### Production Deployment

1. **Create Release Tag**
   ```bash
   git tag v1.2.0
   git push origin v1.2.0
   ```

2. **GitHub Actions** automatically:
   - Builds all platforms
   - Signs with certificates
   - Creates GitHub release
   - Uploads distributables

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes with tests
4. Submit a Pull Request

### Development Guidelines

- Follow existing code style (ESLint configuration)
- Add tests for new features
- Update documentation
- Test on multiple platforms

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **XRPL Integration**: [xrpl.js](https://js.xrpl.org/) - Official XRP Ledger JavaScript library
- **UI Framework**: [Material-UI](https://mui.com/) - React components library
- **Desktop Framework**: [Electron](https://www.electronjs.org/) - Cross-platform desktop apps
- **Drag & Drop**: [@dnd-kit](https://dndkit.com/) - Modern drag and drop
- **Encryption**: [CryptoJS](https://cryptojs.gitbooks.io/) - JavaScript cryptography

## 📞 Support

- **Bug Reports**: [GitHub Issues](https://github.com/FMLBeast/xrp-wallet-manager/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/FMLBeast/xrp-wallet-manager/discussions)
- **Security Issues**: Email security@yourmail.com (not public issues)

## ⚠️ Disclaimer

This software is provided "as is" without warranty of any kind. Users are responsible for:

- Securing their master password and wallet data
- Verifying all transaction details before sending
- Understanding cryptocurrency risks and regulations
- Testing thoroughly before using with significant funds

**Always test with small amounts on testnet before mainnet use.**

---

<div align="center">

**Made with ❤️ for the XRP Ledger community**

*Replace `FMLBeast` with your GitHub username*

</div>