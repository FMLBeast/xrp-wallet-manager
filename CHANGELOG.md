# Changelog

All notable changes to the XRP Wallet Manager will be documented in this file.

## [Unreleased]

### Added
- GitHub Actions CI now packages Linux (amd64, arm64) and macOS builds and publishes them as workflow artifacts.

### Removed
- Legacy `.env`-based wallet loading and the `python-dotenv` dependency—wallet secrets now live exclusively in the encrypted store.
- The `.env.example` template, which is no longer required.

## [1.0.0] - 2025-11-02

### ✨ New Features
- **Modern Multi-Wallet Interface**: Beautiful, card-based design with professional styling
- **Secure Private Key Management**: On-demand private key input, no file storage
- **Multi-Signature Wallet Support**: Create and manage multi-sig wallets with custom quorum
- **Transaction Management**: Send/receive XRP with memo support and validation
- **Transaction History**: View detailed transaction history with filtering options
- **Network Support**: Full testnet and mainnet compatibility
- **Test Wallet Generation**: Automatic test wallet creation with funding
- **Real-time Updates**: Live balance updates and network status monitoring

### 🏗️ Architecture
- Clean separation between GUI (`gui.py`) and wallet logic (`xrp_wallet.py`)
- Thread-safe operations for UI responsiveness
- Modern tkinter styling with custom color schemes
- Modular wallet management system

### 🔐 Security Features
- Private keys requested when needed (not stored in files)
- Comprehensive `.gitignore` to prevent accidental key exposure
- Address validation and transaction confirmations
- Network isolation between testnet and mainnet

### 📦 Dependencies
- `xrpl-py` 4.3.0 - Official XRP Ledger Python library
- `requests` 2.32.5 - HTTP client library

### 🚀 Getting Started
```bash
# Install dependencies
pip install -r requirements.txt

# Run the application
python run.py
```

### 📁 File Structure
```
xrp_wallet_manager/
├── gui.py              # Modern multi-wallet GUI
├── xrp_wallet.py       # Core XRP wallet functionality
├── run.py              # Application launcher
├── requirements.txt    # Dependencies
├── README.md          # Documentation
└── VERSION            # Version information
```

---

*This release provides a complete, production-ready XRP wallet management solution with modern interface design and enterprise-level security practices.*
