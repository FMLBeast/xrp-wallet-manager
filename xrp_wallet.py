"""
XRP Wallet Core Functionality
Handles XRP Ledger interactions, transactions, and multi-signature operations
"""

import os
import json
from typing import Dict, List, Optional, Tuple
from decimal import Decimal
from dotenv import load_dotenv

import xrpl
from xrpl.clients import JsonRpcClient, WebsocketClient
from xrpl.wallet import Wallet, generate_faucet_wallet
from xrpl.models.transactions import Payment, SignerListSet
from xrpl.models.requests import AccountInfo, AccountTx, ServerInfo
from xrpl.models.amounts import IssuedCurrencyAmount
from xrpl.utils import xrp_to_drops, drops_to_xrp
from xrpl.transaction import submit_and_wait, sign, autofill_and_sign


class XRPWalletManager:
    """Main XRP Wallet Management Class"""

    def __init__(self):
        load_dotenv()
        self.network = os.getenv('NETWORK', 'testnet')
        self.client = None
        self.wallet = None
        self.multisig_account = os.getenv('MULTISIG_ACCOUNT')
        self.setup_client()
        self.load_wallet()

    def setup_client(self):
        """Initialize XRP Ledger client"""
        if self.network == 'mainnet':
            url = os.getenv('MAINNET_URL', 'https://xrplcluster.com')
        else:
            url = os.getenv('TESTNET_URL', 'https://s.altnet.rippletest.net:51234')

        self.client = JsonRpcClient(url)

    def load_wallet(self):
        """Load wallet from environment variables"""
        private_key = os.getenv('PRIVATE_KEY')
        if private_key:
            try:
                self.wallet = Wallet.from_secret(private_key)
                return True
            except Exception as e:
                print(f"Error loading wallet: {e}")
                return False
        return False

    def generate_test_wallet(self) -> Tuple[str, str]:
        """Generate a test wallet (testnet only)"""
        if self.network != 'testnet':
            raise ValueError("Test wallet generation only available on testnet")

        test_wallet = generate_faucet_wallet(self.client, debug=True)
        return test_wallet.address, test_wallet.private_key

    def get_account_info(self, address: Optional[str] = None) -> Dict:
        """Get account information"""
        account = address or self.wallet.address

        try:
            account_info = AccountInfo(
                account=account,
                ledger_index="validated"
            )
            response = self.client.request(account_info)

            if response.is_successful():
                account_data = response.result['account_data']
                return {
                    'address': account_data['Account'],
                    'balance': drops_to_xrp(account_data['Balance']),
                    'sequence': account_data['Sequence'],
                    'previous_txn_id': account_data.get('PreviousTxnID', ''),
                    'flags': account_data.get('Flags', 0),
                    'owner_count': account_data.get('OwnerCount', 0),
                    'reserve': account_data.get('Reserve', 0)
                }
            else:
                return {'error': response.result.get('error_message', 'Unknown error')}

        except Exception as e:
            return {'error': str(e)}

    def get_balance(self, address: Optional[str] = None) -> str:
        """Get XRP balance for an address"""
        account_info = self.get_account_info(address)
        if 'error' in account_info:
            return "Error: " + account_info['error']
        return str(account_info['balance'])

    def get_transaction_history(self, address: Optional[str] = None, limit: int = 20) -> List[Dict]:
        """Get transaction history for an account"""
        account = address or self.wallet.address

        try:
            account_tx = AccountTx(
                account=account,
                limit=limit,
                ledger_index_max=-1
            )
            response = self.client.request(account_tx)

            if response.is_successful():
                transactions = []
                for tx in response.result.get('transactions', []):
                    tx_data = tx['tx']
                    transactions.append({
                        'hash': tx_data.get('hash', ''),
                        'type': tx_data.get('TransactionType', ''),
                        'account': tx_data.get('Account', ''),
                        'destination': tx_data.get('Destination', ''),
                        'amount': self._format_amount(tx_data.get('Amount', '')),
                        'fee': drops_to_xrp(tx_data.get('Fee', '0')),
                        'sequence': tx_data.get('Sequence', 0),
                        'date': tx.get('date', 0),
                        'validated': tx.get('validated', False)
                    })
                return transactions
            else:
                return [{'error': response.result.get('error_message', 'Unknown error')}]

        except Exception as e:
            return [{'error': str(e)}]

    def send_payment(self, destination: str, amount: str, memo: Optional[str] = None) -> Dict:
        """Send XRP payment"""
        if not self.wallet:
            return {'error': 'No wallet loaded'}

        try:
            # Convert amount to drops
            amount_drops = xrp_to_drops(Decimal(amount))

            # Create payment transaction
            payment = Payment(
                account=self.wallet.address,
                destination=destination,
                amount=amount_drops,
                sequence=self.get_next_sequence(),
            )

            # Add memo if provided
            if memo:
                payment.memos = [{"Memo": {
                    "MemoData": memo.encode('utf-8').hex()
                }}]

            # Sign and submit transaction
            signed_tx = autofill_and_sign(payment, self.wallet, self.client)
            response = submit_and_wait(signed_tx, self.client)

            if response.is_successful():
                return {
                    'success': True,
                    'hash': response.result['hash'],
                    'validated': response.result.get('validated', False),
                    'engine_result': response.result.get('engine_result', '')
                }
            else:
                return {'error': response.result.get('error_message', 'Transaction failed')}

        except Exception as e:
            return {'error': str(e)}

    def get_next_sequence(self) -> int:
        """Get next sequence number for transactions"""
        account_info = self.get_account_info()
        if 'error' in account_info:
            raise ValueError(f"Cannot get sequence: {account_info['error']}")
        return account_info['sequence']

    def _format_amount(self, amount) -> str:
        """Format amount for display"""
        if isinstance(amount, str):
            return drops_to_xrp(amount)
        elif isinstance(amount, dict):
            return f"{amount['value']} {amount['currency']}"
        return str(amount)

    # Multi-signature wallet methods

    def create_multisig_wallet(self, signers: List[Dict], quorum: int = 2) -> Dict:
        """Create a multi-signature wallet"""
        if not self.wallet:
            return {'error': 'No wallet loaded'}

        try:
            # Create signer list
            signer_entries = []
            for i, signer in enumerate(signers):
                signer_entries.append({
                    "SignerEntry": {
                        "Account": signer['account'],
                        "SignerWeight": signer.get('weight', 1)
                    }
                })

            # Create SignerListSet transaction
            signer_list_set = SignerListSet(
                account=self.wallet.address,
                signer_quorum=quorum,
                signer_entries=signer_entries
            )

            # Sign and submit
            signed_tx = autofill_and_sign(signer_list_set, self.wallet, self.client)
            response = submit_and_wait(signed_tx, self.client)

            if response.is_successful():
                return {
                    'success': True,
                    'hash': response.result['hash'],
                    'multisig_account': self.wallet.address
                }
            else:
                return {'error': response.result.get('error_message', 'Failed to create multisig')}

        except Exception as e:
            return {'error': str(e)}

    def sign_multisig_transaction(self, transaction_json: str, signer_wallet: Wallet) -> Dict:
        """Sign a transaction for multi-signature"""
        try:
            tx_dict = json.loads(transaction_json)

            # Sign the transaction
            signed = sign(tx_dict, signer_wallet)

            return {
                'success': True,
                'signed_transaction': signed,
                'signer': signer_wallet.address
            }

        except Exception as e:
            return {'error': str(e)}

    def submit_multisig_transaction(self, signed_transactions: List[Dict]) -> Dict:
        """Submit multi-signed transaction"""
        try:
            # Combine signatures
            base_tx = signed_transactions[0]

            # Add additional signatures
            for signed_tx in signed_transactions[1:]:
                # This is a simplified version - full implementation would merge signatures
                pass

            # Submit the transaction
            response = submit_and_wait(base_tx, self.client)

            if response.is_successful():
                return {
                    'success': True,
                    'hash': response.result['hash']
                }
            else:
                return {'error': response.result.get('error_message', 'Multisig submission failed')}

        except Exception as e:
            return {'error': str(e)}

    def get_network_info(self) -> Dict:
        """Get network information"""
        try:
            server_info = ServerInfo()
            response = self.client.request(server_info)

            if response.is_successful():
                info = response.result.get('info', {})
                return {
                    'network': self.network,
                    'server_state': info.get('server_state', ''),
                    'validated_ledger': info.get('validated_ledger', {}),
                    'reserve_base': info.get('validated_ledger', {}).get('reserve_base_xrp', 1),
                    'reserve_inc': info.get('validated_ledger', {}).get('reserve_inc_xrp', 0.2)
                }
            else:
                return {'error': response.result.get('error_message', 'Failed to get network info')}

        except Exception as e:
            return {'error': str(e)}

    def validate_address(self, address: str) -> bool:
        """Validate XRP address format"""
        try:
            # Basic validation - XRP addresses start with 'r' and are typically 25-34 characters
            if not address.startswith('r'):
                return False
            if len(address) < 25 or len(address) > 34:
                return False

            # Try to get account info - if it exists, address is valid
            # If it doesn't exist, we'll get a specific error
            account_info = AccountInfo(account=address)
            response = self.client.request(account_info)

            # Even if account doesn't exist, the address format could be valid
            return True

        except Exception:
            return False