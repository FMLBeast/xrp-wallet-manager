# XRP Wallet Manager
> Secure desktop application for managing XRP Ledger wallets, secrets, and multisig signers.

XRP Wallet Manager is a cross-platform GUI built with Python and tkinter. It keeps wallet secrets encrypted on disk, wraps common XRP Ledger flows in a friendly interface, and ships with tooling to produce signed installers for macOS, Linux, and Windows.

## Table of Contents
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Packaging installers](#packaging-installers)
- [Configuration](#configuration)
- [Application Tabs](#application-tabs)
- [Security Features](#security-features)
- [Multi-Signature Wallets](#multi-signature-wallets)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)
- [Security](#security)

## Features

### Modern Interface (NEW!)
- **Multi-Wallet Management**: Manage multiple XRP wallets in one application
- **Beautiful Modern Design**: Clean, professional interface with modern styling
- **Secure Key Input**: Private keys requested on-demand, not stored in files
- **Wallet Switching**: Easy switching between different wallets
- **Smart Wallet Cards**: Visual wallet overview with balances and network info
- **Persistent Wallets**: Secrets saved locally so wallets survive app restarts (see security notes)

### Core Functionality
- **Full Wallet Management**: Send/receive XRP, check balances, view transaction history
- **Multi-Signature Support**: Create and manage multi-signature wallets
- **Network Support**: Works with both mainnet and testnet
- **Transaction History**: View detailed transaction history with filtering
- **Test Wallet Generation**: Generate test wallets for testnet development
- **Address Validation**: Automatic validation of XRP addresses

## Installation

1. **Clone or download this repository**

2. **Create a virtual environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure your wallet:**
   - Copy `.env.example` to `.env`
   - Add your seed or private key to the `WALLET_SECRET` field in `.env`
   - Set `NETWORK` to either `testnet` or `mainnet`

## Usage

### Starting the Application

```bash
source venv/bin/activate  # Activate virtual environment
python run.py
# or directly: python gui.py
```

## Packaging installers

**macOS**
- Prerequisites: Python 3.10+, PyInstaller, Xcode command line tools for code signing.
- Activate your virtualenv, then run `pyinstaller "XRP Wallet Manager.spec"` or `pyinstaller --windowed --name "XRP Wallet Manager" run.py`.
- The signed `.app` bundle lands in `dist/XRP Wallet Manager.app`; create a DMG (e.g. with `create-dmg`) if you need a disk image.

**Linux (native host)**
- On a Linux workstation run `installers/linux/build.sh`. It spins up `.venv-linux/`, installs dependencies, and emits `dist-linux/XRP-Wallet-Manager/` plus the helper launcher `dist-linux/run.sh`.
- Result is a folder-style distribution that can be tarred and shipped.

**Linux (Docker on macOS/Windows)**
- Start a Docker-compatible runtime (e.g. `colima start --arch x86_64` on Apple Silicon if you need x86_64 output).
- Execute `installers/linux/run-build.sh`. The script builds the container image (`installers/linux/Dockerfile`) and runs the native Linux build inside it. Artifacts still appear in the host `dist-linux/` directory.
- Stop the runtime afterwards (`colima stop`).

**Windows**
- Install Python 3.10+, the Visual Studio 2022 Build Tools (for C runtime), and `pip install pyinstaller -r requirements.txt`.
- From an activated `venv\Scripts\activate`, run `pyinstaller --clean --noconfirm --windowed --name "XRP Wallet Manager" run.py`.
- Bundles are written to `dist\XRP Wallet Manager\`. Optionally wrap them in an installer using your preferred tooling (MSIX, Inno Setup, etc.).

On first launch you will be prompted to create a master password. This password encrypts your wallets on disk and is required every time the app starts. Keep it safe—if you lose it you will need to re-import your wallets from their original secrets.

## Configuration

Edit the `.env` file with your settings:

```env
# Your XRP wallet secret (family seed starting with 's' or hex private key)
WALLET_SECRET=your_seed_or_private_key_here
# Legacy fallback name for backwards compatibility
PRIVATE_KEY=

# Network (testnet for development, mainnet for production)
NETWORK=testnet

# Server URLs (defaults provided)
MAINNET_URL=https://xrplcluster.com
TESTNET_URL=https://s.altnet.rippletest.net:51234
```

### Getting Started

1. **For Testing (Recommended for first-time users):**
   - Set `NETWORK=testnet` in your `.env` file
   - Use the "Generate Test Wallet" button to create a test wallet
   - Copy the generated private key to your `.env` file
   - Restart the application

2. **For Production:**
   - Set `NETWORK=mainnet` in your `.env` file
   - Add your existing private key to the `.env` file

## Application Tabs

### 1. Wallet Tab
- View wallet address, balance, and network information
- Copy address to clipboard
- Generate test wallets (testnet only)
- View network status and reserve requirements

### 2. Send Tab
- Send XRP to any address
- Add optional memos to transactions
- View transaction results
- Automatic address validation

### 3. History Tab
- View transaction history
- Filter by number of transactions
- See transaction details including type, amounts, and dates

### 4. Multi-Sig Tab
- Create multi-signature wallets
- Sign multi-signature transactions
- Submit combined signatures

### 5. Settings Tab
- View current network settings
- Manage private keys (manual .env editing required)

## Security Features

- **Private Key Protection**: Keys stored in .env files, never displayed in GUI
- **Address Validation**: Automatic validation of XRP addresses
- **Transaction Confirmation**: Confirmation dialogs for all transactions
- **Network Isolation**: Separate testnet and mainnet configurations

## Multi-Signature Wallets

This application supports creating and managing multi-signature wallets:

1. **Creating a Multi-Sig Wallet:**
   - Enter signer addresses (one per line) in the Multi-Sig tab
   - Set the required number of signatures
   - Click "Create Multi-Sig Wallet"

2. **Signing Transactions:**
   - Load a transaction JSON file
   - Sign with your private key
   - Save the signed transaction
   - Combine with other signatures before submission

## Important Notes

### Security Warnings

- **Never share your private key** with anyone
- **Keep your .env file secure** and never commit it to version control
- **Protect `data/wallets.enc`** – the GUI stores encrypted secrets here; keep it private and backed up.
- **Use testnet for development** and testing
- **Master password is required** – it encrypts `data/wallets.enc`. Losing it means you must restore wallets from the original seed/private key backups.
- **Verify addresses carefully** before sending transactions

### XRP Ledger Requirements

- **Account Reserve**: 1 XRP minimum balance (reduced from 10 XRP in December 2024)
- **Owner Reserve**: 0.2 XRP per object (trustlines, offers, etc.)
- **Transaction Fees**: Small network fees apply to all transactions

### Network Differences

- **Testnet**: Free test XRP, safe for development
- **Mainnet**: Real XRP, use for production only

## Troubleshooting

### Common Issues

1. **"No wallet loaded" error:**
   - Check that your private key is correctly set in the `.env` file
   - Ensure the private key is a valid 64-character hex string

2. **Connection errors:**
   - Check your internet connection
   - Verify the network URLs in your `.env` file

3. **Transaction failures:**
   - Ensure sufficient XRP balance (including reserves)
   - Verify destination address format
   - Check network connectivity

### Getting Help

- Check the transaction result display for detailed error messages
- Use testnet for safe testing
- Verify all addresses before sending real XRP

## Development

### File Structure

```
xrp_wallet_manager/
├── gui.py              # Modern multi-wallet GUI application
├── xrp_wallet.py       # Core XRP wallet functionality
├── run.py              # Application launcher
├── .env.example        # Template for environment variables
├── requirements.txt    # Python dependencies
└── README.md          # This file
```

### Dependencies

- `xrpl-py`: Official XRP Ledger Python library
- `python-dotenv`: Environment variable management
- `requests`: HTTP client for API calls
- `tkinter`: GUI framework (included with Python)

## Contributing

We welcome bug reports, feature suggestions, and pull requests. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on local setup, coding standards, and how to run checks before submitting changes.

## License

Distributed under the [MIT License](LICENSE). You are free to use, modify, and distribute the software under its terms.

## Security

See [SECURITY.md](SECURITY.md) for supported versions and how to report vulnerabilities. Please do not post sensitive details in public issues.

## Disclaimer

This software is provided “as is” without warranty of any kind. Always test on testnet before interacting with mainnet funds, and back up any secrets exported from the application.
