# XRP Wallet Manager - Electron Desktop App

**A secure, modern XRP wallet built with Electron and React.**

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![License](https://img.shields.io/badge/license-MIT-green)

## 🚀 Features

### Wallet Management
- **Multi-wallet Support**: Manage unlimited XRP wallets in one app
- **Import Options**: Family seeds, private keys, mnemonic phrases, ED25519 seeds
- **Test Wallet Generation**: One-click testnet wallet with automatic funding
- **Network Switching**: Support for Mainnet, Testnet, and Devnet
- **Address Book**: Save frequently used addresses

### Security
- **Master Password Protection**: AES-CTR encryption with PBKDF2-SHA256 (390,000 iterations)
- **Local Storage**: All private keys stored encrypted on your device
- **Context Isolation**: Electron security best practices
- **Backup/Restore**: Export and restore encrypted wallet data
- **No Network Exposure**: Private keys never leave your device

### Transactions
- **Send XRP**: Easy payment interface with fee calculation
- **Receive**: QR code generation for easy address sharing
- **Transaction History**: View complete transaction history with filtering
- **Destination Tags**: Full support for destination tags
- **Multi-signature**: Create and manage multi-signature wallets

### User Experience
- **Modern UI**: Beautiful Material Design interface with dark mode
- **Real-time Updates**: Live balance and transaction updates
- **Cross-platform**: Native app for Windows, macOS, and Linux
- **Keyboard Shortcuts**: Native menu with keyboard shortcuts
- **Network Explorer**: Direct links to XRPL explorers

## 📦 Installation

### Prerequisites
- Node.js 18 or higher
- npm or yarn

### Quick Start

```bash
# Clone the repository
git clone https://github.com/FMLBeast/xrp-wallet-manager.git
cd xrp-wallet-manager

# Install dependencies
npm install

# Start in development mode
npm run electron-dev
```

## 🛠️ Development

### Available Scripts

```bash
# Start React development server
npm start

# Start Electron app in development mode (with hot reload)
npm run electron-dev

# Run unit tests
npm test

# Run E2E tests
npm run e2e

# Build React app
npm run build

# Lint code
npm run lint
```

### Project Structure

```
xrp-wallet-manager/
├── src/
│   ├── components/        # React UI components
│   │   ├── WalletTabs.js
│   │   ├── MasterPasswordDialog.js
│   │   ├── ImportWalletDialog.js
│   │   ├── TransactionHistory.js
│   │   └── ...
│   ├── utils/            # Core utilities
│   │   ├── encryption.js      # Encryption/decryption
│   │   ├── walletStorage.js   # Wallet persistence
│   │   ├── xrplWallet.js      # XRPL integration
│   │   └── __tests__/         # Unit tests
│   └── App.js            # Main React component
├── public/               # Static assets
├── assets/              # App icons
├── main.js              # Electron main process
├── preload.js           # Electron preload script
├── craco.config.js      # Webpack configuration
└── package.json         # Dependencies and scripts
```

## 🏗️ Building for Production

### Before Building

1. **Generate App Icons** (required):
   ```bash
   cd assets
   # Install ImageMagick first (see assets/README.md)
   ./generate-icons.sh
   ```

2. **Update Version** in `package.json`

### Build Commands

```bash
# Build for current platform
npm run dist

# Build for all platforms (macOS only)
npm run dist-all

# Builds will be in dist-electron/
```

### Platform-Specific Builds

**macOS**
```bash
npm run dist
# Outputs: dist-electron/XRP Wallet Manager-1.0.0.dmg
#          dist-electron/XRP Wallet Manager-1.0.0-mac.zip
```

**Windows**
```bash
npm run dist
# Outputs: dist-electron/XRP Wallet Manager Setup 1.0.0.exe
#          dist-electron/XRP Wallet Manager 1.0.0.exe (portable)
```

**Linux**
```bash
npm run dist
# Outputs: dist-electron/XRP Wallet Manager-1.0.0.AppImage
#          dist-electron/xrp-wallet-manager_1.0.0_amd64.deb
#          dist-electron/xrp-wallet-manager-1.0.0.x86_64.rpm
```

## 📖 Usage Guide

### First Time Setup

1. **Launch the app**
2. **Create a Master Password**
   - Minimum 12 characters
   - Must include uppercase, lowercase, numbers, and special characters
   - This password encrypts all your wallet data
   - ⚠️ **Cannot be recovered if lost!**

3. **Add Your First Wallet**
   - Click "+" or use File → New Wallet / Import Wallet
   - For testnet testing: Choose "Generate Test Wallet"
   - For existing wallets: Import your seed/private key

### Managing Wallets

**Import a Wallet**
- File → Import Wallet (Cmd/Ctrl+I)
- Enter your wallet secret (seed, private key, or mnemonic)
- Choose a wallet name
- Select network (mainnet/testnet/devnet)

**Send XRP**
- Select wallet from sidebar
- Click "Send" tab
- Enter recipient address, amount, and optional destination tag
- Review transaction details
- Confirm with master password

**Receive XRP**
- Select wallet from sidebar
- Click "Receive" tab
- Copy address or scan QR code

**View Transactions**
- Select wallet from sidebar
- Click "History" tab
- Filter by type, date, or search

### Keyboard Shortcuts

- `Cmd/Ctrl+N` - New Wallet
- `Cmd/Ctrl+I` - Import Wallet
- `Cmd/Ctrl+S` - Send Transaction
- `Cmd/Ctrl+R` - Receive
- `Cmd/Ctrl+F5` - Refresh Balance

## 🔒 Security

### Best Practices

1. **Master Password**
   - Use a strong, unique password
   - Store in a password manager
   - Never share with anyone

2. **Backups**
   - Regularly export wallet data (File → Export Wallet Data)
   - Store backup file securely offline
   - Test restore process

3. **Private Keys**
   - Never share your seed or private key
   - Wallet secrets are only stored encrypted locally
   - App never transmits private keys over network

4. **Updates**
   - Keep app updated for security patches
   - Verify downloads from official sources

### Encryption Details

- **Algorithm**: AES-CTR stream cipher
- **Key Derivation**: PBKDF2-SHA256 with 390,000 iterations
- **MAC**: HMAC-SHA256 for integrity verification
- **Storage Location**:
  - macOS: `~/Library/Application Support/xrp-wallet-manager/wallets.enc`
  - Windows: `%APPDATA%/xrp-wallet-manager/wallets.enc`
  - Linux: `~/.config/xrp-wallet-manager/wallets.enc`

## 🧪 Testing

### Unit Tests

```bash
npm test -- --watchAll=false --coverage
```

Coverage reports in `coverage/` directory.

### E2E Tests

```bash
# Run E2E tests
npm run e2e

# Run with UI
npm run e2e:ui

# Run in headed mode (see browser)
npm run e2e:headed
```

## 🐛 Troubleshooting

### App Won't Start

1. Check Node.js version: `node --version` (should be 18+)
2. Reinstall dependencies: `rm -rf node_modules && npm install`
3. Clear cache: `rm -rf build dist-electron`

### "Invalid Master Password" Error

- Ensure no leading/trailing spaces when typing password
- Try resetting wallet data (⚠️ will delete all wallets):
  - Delete encrypted file at storage location
  - Restart app and create new master password

### Balance Not Updating

1. Check network connection
2. Verify correct network selected (mainnet/testnet)
3. Click Refresh (Cmd/Ctrl+F5)
4. For testnet: Ensure account is funded

### Build Errors

1. **Missing Icons**: Run `cd assets && ./generate-icons.sh`
2. **Electron Builder Fails**: Clear cache `rm -rf dist-electron`
3. **macOS Code Signing**: Set `CSC_IDENTITY_AUTO_DISCOVERY=false` to skip signing

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for more details.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- UI powered by [Material-UI](https://mui.com/)
- XRPL integration via [xrpl.js](https://js.xrpl.org/)

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/FMLBeast/xrp-wallet-manager/issues)
- **Discussions**: [GitHub Discussions](https://github.com/FMLBeast/xrp-wallet-manager/discussions)

## ⚠️ Disclaimer

This software is provided "as is" without warranty. Users are responsible for:
- Securing their master password
- Backing up wallet data
- Verifying transaction details before sending
- Understanding cryptocurrency risks

Always test with small amounts on testnet before using on mainnet.

---

**Made with ❤️ for the XRP Ledger community**
