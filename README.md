# XRP Wallet Manager

A comprehensive XRP wallet management application built with Python and tkinter, featuring full wallet functionality including multi-signature support.

## Features

### Modern Interface (NEW!)
- **Multi-Wallet Management**: Manage multiple XRP wallets in one application
- **Beautiful Modern Design**: Clean, professional interface with modern styling
- **Secure Key Input**: Private keys requested on-demand, not stored in files
- **Wallet Switching**: Easy switching between different wallets
- **Smart Wallet Cards**: Visual wallet overview with balances and network info

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
   - Add your private key to the `PRIVATE_KEY` field in `.env`
   - Set `NETWORK` to either `testnet` or `mainnet`

## Usage

### Starting the Application

```bash
source venv/bin/activate  # Activate virtual environment
python run.py
# or directly: python gui.py
```

### Configuration

Edit the `.env` file with your settings:

```env
# Your XRP wallet private key (64-character hex string)
PRIVATE_KEY=your_private_key_here

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
- **Use testnet for development** and testing
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

## License

This project is open source. Use at your own risk and ensure you understand XRP Ledger mechanics before using with real funds.

## Disclaimer

This software is provided as-is. Always test with small amounts and on testnet before using with significant funds. The developers are not responsible for any loss of funds.