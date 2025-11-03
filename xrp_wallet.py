"""
XRP Wallet Core Functionality
Handles XRP Ledger interactions, transactions, and multi-signature operations
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from decimal import Decimal
from hashlib import sha512
from typing import Dict, List, Optional, Tuple

import requests
from datetime import datetime

from dotenv import load_dotenv
from ecpy.curves import Curve
from ecpy.eddsa import EDDSA
from ecpy.keys import ECPrivateKey

from xrpl.clients import JsonRpcClient
from xrpl.constants import CryptoAlgorithm
from xrpl.wallet import Wallet, generate_faucet_wallet
from xrpl.models.transactions import Memo, Payment, SignerListSet
from xrpl.models.requests import AccountInfo, AccountTx, ServerInfo, AccountObjects, GenericRequest
from xrpl.models.amounts import IssuedCurrencyAmount
from xrpl.utils import drops_to_xrp, xrp_to_drops
from xrpl.transaction import autofill_and_sign, sign, submit_and_wait
from xrpl.core.keypairs import ed25519 as ed_impl
from xrpl.core.keypairs import secp256k1 as secp_impl


HEX_PATTERN = re.compile(r"^[0-9A-F]+$")


@dataclass
class SecretInfo:
    """
    Canonical representation of wallet secrets used throughout the app.
    """

    secret: str  # Either a seed (base58) or a raw private key in hex
    secret_type: str  # "seed" or "private_key"
    algorithm: CryptoAlgorithm
    public_key: str
    private_key: str

    def serialize(self) -> Dict[str, str]:
        """Convert to JSON-friendly dict."""
        return {
            "secret": self.secret,
            "secret_type": self.secret_type,
            "algorithm": self.algorithm.value,
            "public_key": self.public_key,
            "private_key": self.private_key,
        }

    def make_wallet(self) -> Wallet:
        """Create a Wallet instance from this secret info."""
        seed = self.secret if self.secret_type == "seed" else None
        return Wallet(
            self.public_key,
            self.private_key,
            seed=seed,
            algorithm=self.algorithm,
        )


def _derive_public_key_secp256k1(private_key_hex: str) -> str:
    """Derive compressed public key for a secp256k1 private key."""
    normalized = private_key_hex.upper()
    private_int = int(normalized, 16)
    curve: Curve = secp_impl._CURVE  # type: ignore[attr-defined]
    private_obj = ECPrivateKey(private_int, curve)
    public_obj = private_obj.get_public_key()
    return curve.encode_point(public_obj.W, compressed=True).hex().upper()


def _derive_public_key_ed25519(private_key_hex: str) -> str:
    """Derive public key for an Ed25519 private key that includes the ED prefix."""
    normalized = private_key_hex.upper()
    if not normalized.startswith(ed_impl.PREFIX):
        raise ValueError("Ed25519 private key must start with 'ED'")
    raw_hex = normalized[len(ed_impl.PREFIX) :]
    curve: Curve = ed_impl._CURVE  # type: ignore[attr-defined]
    private_obj = ECPrivateKey(int(raw_hex, 16), curve)
    public_obj = EDDSA(sha512).get_public_key(private_obj, sha512)
    public_hex = curve.encode_point(public_obj.W).hex().upper()
    return ed_impl.PREFIX + public_hex


def create_wallet_from_secret(
    secret: str,
    *,
    public_key: Optional[str] = None,
    algorithm_hint: Optional[str] = None,
) -> Tuple[Wallet, SecretInfo]:
    """
    Create a wallet from a seed or raw private key.

    Args:
        secret: User-provided secret (seed or private key).
        public_key: Optional cached public key to avoid recomputation.
        algorithm_hint: Optional algorithm hint ("ed25519" or "secp256k1").

    Returns:
        Tuple of (Wallet instance, SecretInfo metadata).

    Raises:
        ValueError: If the secret cannot be parsed or is invalid.
    """

    if not secret:
        raise ValueError("Secret value is empty")

    candidate = secret.strip()

    # First attempt: treat as seed
    if candidate.startswith("s"):
        try:
            wallet = Wallet.from_seed(candidate)
            info = SecretInfo(
                secret=candidate,
                secret_type="seed",
                algorithm=wallet.algorithm,
                public_key=wallet.public_key,
                private_key=wallet.private_key,
            )
            return wallet, info
        except Exception as exc:
            raise ValueError(f"Invalid XRP seed: {exc}") from exc

    normalized = candidate.upper()
    is_hex = HEX_PATTERN.fullmatch(normalized) is not None
    algo_hint = (algorithm_hint or "").lower()

    # Ed25519 private key with ED prefix (66 chars)
    if normalized.startswith("ED") and len(normalized) == 66 and HEX_PATTERN.fullmatch(
        normalized[2:]
    ):
        algorithm = CryptoAlgorithm.ED25519
        pub_key = public_key or _derive_public_key_ed25519(normalized)
        wallet = Wallet(pub_key, normalized, algorithm=algorithm)
        info = SecretInfo(
            secret=normalized,
            secret_type="private_key",
            algorithm=algorithm,
            public_key=pub_key,
            private_key=normalized,
        )
        return wallet, info

    # Raw secp256k1 private key (64 hex characters)
    if is_hex and len(normalized) == 64:
        algorithm = CryptoAlgorithm.SECP256K1
        if algo_hint == "ed25519":
            raise ValueError(
                "Secret marked as ed25519 but does not include the required 'ED' prefix."
            )

        pub_key = public_key or _derive_public_key_secp256k1(normalized)
        wallet = Wallet(pub_key, normalized, algorithm=algorithm)
        info = SecretInfo(
            secret=normalized,
            secret_type="private_key",
            algorithm=algorithm,
            public_key=pub_key,
            private_key=normalized,
        )
        return wallet, info

    raise ValueError(
        "Unrecognized secret format. Provide a valid XRP seed or private key."
    )


class XRPWalletManager:
    """Main XRP Wallet Management Class"""

    def __init__(self, network: Optional[str] = None, auto_load_env: bool = True):
        load_dotenv()
        self.network = network or os.getenv("NETWORK", "testnet")
        self.client: Optional[JsonRpcClient] = None
        self.wallet: Optional[Wallet] = None
        self.secret_info: Optional[SecretInfo] = None
        self.multisig_account = os.getenv("MULTISIG_ACCOUNT")
        self.setup_client()
        if auto_load_env:
            self.load_wallet()

    def setup_client(self):
        """Initialize XRP Ledger client"""
        if self.network == "mainnet":
            url = os.getenv("MAINNET_URL", "https://xrplcluster.com")
        else:
            url = os.getenv("TESTNET_URL", "https://s.altnet.rippletest.net:51234")

        self.client = JsonRpcClient(url)

    def load_wallet(self):
        """Load wallet from environment variables"""
        secret_candidates = [
            os.getenv("WALLET_SECRET"),
            os.getenv("PRIVATE_KEY"),
            os.getenv("SEED"),
        ]
        secret = next((value for value in secret_candidates if value), None)
        if not secret:
            return False

        try:
            wallet, info = create_wallet_from_secret(secret)
            self.wallet = wallet
            self.secret_info = info
            return True
        except Exception as exc:
            print(f"Error loading wallet: {exc}")
            return False

    def load_wallet_from_secret(
        self,
        secret: str,
        *,
        public_key: Optional[str] = None,
        algorithm: Optional[str] = None,
    ) -> bool:
        """Load wallet from provided secret info."""
        try:
            wallet, info = create_wallet_from_secret(
                secret, public_key=public_key, algorithm_hint=algorithm
            )
            self.wallet = wallet
            self.secret_info = info
            return True
        except Exception as exc:
            print(f"Error loading wallet from secret: {exc}")
            return False

    def use_wallet(self, wallet: Wallet, info: SecretInfo) -> None:
        """Use an already constructed wallet instance."""
        self.wallet = wallet
        self.secret_info = info

    def generate_test_wallet(self) -> Tuple[Wallet, SecretInfo]:
        """Generate a test wallet (testnet only)"""
        if self.network != "testnet":
            raise ValueError("Test wallet generation only available on testnet")

        test_wallet = generate_faucet_wallet(self.client, debug=True)
        secret_value = getattr(test_wallet, "seed", None) or test_wallet.private_key
        secret_info = SecretInfo(
            secret=secret_value,
            secret_type="seed" if getattr(test_wallet, "seed", None) else "private_key",
            algorithm=getattr(test_wallet, "algorithm", CryptoAlgorithm.ED25519),
            public_key=test_wallet.public_key,
            private_key=test_wallet.private_key,
        )
        return test_wallet, secret_info

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
                ledger_index_min=-1,
                ledger_index_max=-1,
                forward=False,
                binary=False,
            )
            response = self.client.request(account_tx)

            if response.is_successful():
                transactions = []
                for tx in response.result.get('transactions', []):
                    tx_data = tx.get('tx')
                    if not tx_data:
                        continue
                    account_value = self._extract_value(tx_data, ['Account', 'account', 'from', 'source'])
                    destination_value = self._extract_value(tx_data, ['Destination', 'destination', 'to', 'target'])
                    destination_tag = self._extract_value(tx_data, ['DestinationTag', 'destination_tag'])
                    amount_value = self._extract_value(tx_data, ['Amount', 'amount'])
                    seq_value = self._extract_value(tx_data, ['Sequence', 'sequence'])
                    dest_tag_val = destination_tag
                    if dest_tag_val is not None:
                        try:
                            dest_tag_val = int(dest_tag_val)
                        except Exception:
                            pass
                transactions.append({
                    'hash': tx_data.get('hash', ''),
                    'type': self._extract_value(tx_data, ['TransactionType', 'type']),
                    'account': account_value,
                    'destination': destination_value,
                    'destination_tag': dest_tag_val,
                    'amount': self._format_amount(amount_value),
                    'fee': self._format_fee(tx_data.get('Fee', '0')),
                        'sequence': int(seq_value) if str(seq_value).isdigit() else 0,
                        'date': self._parse_date(tx.get('date')),
                        'validated': tx.get('validated', False),
                        'raw': tx,
                    })
                if transactions:
                    return transactions
                fallback = self._fetch_history_fallback(account, limit)
                if fallback is not None:
                    return fallback
                return transactions
            else:
                fallback = self._fetch_history_fallback(account, limit)
                if fallback is not None:
                    return fallback
                return [{'error': response.result.get('error_message', 'Unknown error')}]

        except Exception as e:
            fallback = self._fetch_history_fallback(account, limit)
            if fallback is not None:
                return fallback
            return [{'error': str(e)}]

    def _fetch_history_fallback(self, account: str, limit: int) -> Optional[List[Dict]]:
        if self.network != 'mainnet':
            return None

        providers = [
            self._fetch_history_from_xrpscan,
            self._fetch_history_from_rippledata,
        ]
        last_error = None
        for provider in providers:
            try:
                entries = provider(account, limit)
                if entries:
                    return entries
            except Exception as exc:
                last_error = str(exc)
                continue
        if last_error:
            return [{'error': last_error}]
        return None

    def _fetch_history_from_rippledata(self, account: str, limit: int) -> List[Dict]:
        resp = requests.get(
            f"https://data.ripple.com/v2/accounts/{account}/transactions",
            params={"limit": limit, "type": "Payment"},
            timeout=10,
        )
        resp.raise_for_status()
        payload = resp.json()
        records = payload.get('transactions', [])
        results: List[Dict] = []
        for item in records:
            tx = item.get('tx', {})
            if not tx:
                continue
            account_value = self._extract_value(tx, ['Account', 'account'])
            destination_value = self._extract_value(tx, ['Destination', 'destination'])
            destination_tag = self._extract_value(tx, ['DestinationTag', 'destination_tag'])
            amount_value = self._extract_value(tx, ['Amount', 'amount']) or self._extract_value(item.get('meta', {}), ['delivered_amount'])
            date_value = item.get('date') or tx.get('date')
            if destination_tag is not None:
                try:
                    destination_tag = int(destination_tag)
                except Exception:
                    pass
            seq_val = self._extract_value(tx, ['Sequence', 'sequence'])
            results.append({
                'hash': tx.get('hash', ''),
                'type': self._extract_value(tx, ['TransactionType', 'type']),
                'account': account_value,
                'destination': destination_value,
                'destination_tag': destination_tag,
                'amount': self._format_amount(amount_value),
                'fee': self._format_fee(tx.get('Fee', '0')),
                'sequence': int(seq_val) if str(seq_val).isdigit() else 0,
                'date': self._parse_date(date_value),
                'validated': item.get('validated', False),
                'raw': item,
            })
        return results

    def _fetch_history_from_xrpscan(self, account: str, limit: int) -> List[Dict]:
        resp = requests.get(
            f"https://api.xrpscan.com/api/v1/account/{account}/transactions",
            params={"limit": limit},
            timeout=10,
        )
        resp.raise_for_status()
        payload = resp.json()
        records = payload.get('transactions', [])
        results: List[Dict] = []
        for tx in records:
            account_value = self._extract_value(tx, ['Account', 'account', 'from'])
            destination_value = self._extract_value(tx, ['Destination', 'destination', 'to'])
            destination_tag = self._extract_value(tx, ['DestinationTag', 'destination_tag'])
            amount_value = (self._extract_value(tx, ['Amount', 'amount'])
                            or self._extract_value(tx.get('meta', {}), ['delivered_amount']))
            fee_value = self._extract_value(tx, ['Fee', 'fee'])
            if destination_tag is not None:
                try:
                    destination_tag = int(destination_tag)
                except Exception:
                    pass
            seq_val = self._extract_value(tx, ['Sequence', 'sequence'])
            results.append({
                'hash': tx.get('hash', ''),
                'type': self._extract_value(tx, ['type', 'TransactionType']),
                'account': account_value,
                'destination': destination_value,
                'destination_tag': destination_tag,
                'amount': self._format_amount(amount_value),
                'fee': self._format_fee(fee_value or '0'),
                'sequence': int(seq_val) if str(seq_val).isdigit() else 0,
                'date': self._parse_date(self._extract_value(tx, ['date', 'timestamp'])),
                'validated': tx.get('validated', False),
                'raw': tx,
            })
        return results

    def send_payment(
        self,
        destination: str,
        amount: str,
        memo: Optional[str] = None,
        destination_tag: Optional[int] = None,
    ) -> Dict:
        """Send XRP payment"""
        if not self.wallet:
            return {'error': 'No wallet loaded'}

        try:
            memo_list = None
            if memo:
                memo_bytes = memo.encode("utf-8")
                memo_list = [Memo(memo_data=memo_bytes.hex())]

            # Convert amount to drops
            amount_drops = xrp_to_drops(Decimal(amount))

            # Create payment transaction
            payment = Payment(
                account=self.wallet.address,
                destination=destination,
                amount=amount_drops,
                sequence=self.get_next_sequence(),
                memos=memo_list,
                destination_tag=destination_tag,
            )

            # Sign and submit transaction
            signed_tx = autofill_and_sign(payment, self.client, self.wallet)
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
            clean = amount.strip()
            if clean.upper().endswith("XRP"):
                numeric = clean[:-3].strip()
                if numeric.replace('.', '', 1).isdigit():
                    try:
                        drops_value = Decimal(numeric)
                        if drops_value == drops_value.to_integral_value():
                            return f"{(drops_value / Decimal(1_000_000)).quantize(Decimal('0.000001'))}"
                    except Exception:
                        pass
            if clean.isdigit():
                return drops_to_xrp(clean)
            try:
                return str(Decimal(clean))
            except Exception:
                return clean
        if isinstance(amount, (int, float, Decimal)):
            dec = Decimal(amount)
            if isinstance(amount, int) or dec == dec.to_integral_value():
                dec = dec / Decimal(1_000_000)
                return f"{dec.quantize(Decimal('0.000001'))}"
            return str(dec)
        if isinstance(amount, dict):
            value = amount.get('value')
            currency = amount.get('currency', 'XRP')
            if value is None:
                return str(amount)
            try:
                dec = Decimal(value)
            except Exception:
                return str(value)
            if currency and currency.upper() == 'XRP':
                if dec == dec.to_integral_value():
                    dec = dec / Decimal(1_000_000)
                return f"{dec.quantize(Decimal('0.000001'))}"
            return f"{dec} {currency}"
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
            signed = sign(tx_dict, signer_wallet, multisign=True)

            return {
                'success': True,
                'signed_transaction': signed,
                'signer': signer_wallet.address,
                'tx_blob': signed.get('tx_blob'),
                'tx_json': signed.get('tx_json'),
            }

        except Exception as e:
            return {'error': str(e)}

    def submit_multisig_transaction(self, signed_transactions: List[Dict]) -> Dict:
        """Submit multi-signed transaction"""
        try:
            blobs = []
            for entry in signed_transactions:
                blob = entry.get('tx_blob') or entry.get('signed_transaction', {}).get('tx_blob')
                if blob:
                    blobs.append(blob)
            if not blobs:
                return {'error': 'No signed transactions provided'}

            combine_request = GenericRequest(method='combine', params=[{'txs': blobs}])
            combine_response = self.client.request(combine_request)
            if not combine_response.is_successful():
                return {'error': combine_response.result.get('error_message', 'Combine request failed')}

            combined_blob = combine_response.result.get('tx_blob')
            if not combined_blob:
                return {'error': 'Combine did not return tx_blob'}

            response = submit_and_wait(combined_blob, self.client)

            if response.is_successful():
                return {
                    'success': True,
                    'hash': response.result['hash'],
                    'tx_json': combine_response.result.get('tx_json')
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

    def get_signer_list(self, account: Optional[str] = None) -> Dict:
        acct = account or (self.wallet.address if self.wallet else None)
        if not acct:
            return {'enabled': False}
        try:
            response = self.client.request(AccountObjects(account=acct, type="signer_list"))
            if not response.is_successful():
                return {'enabled': False}
            objects = response.result.get('account_objects', [])
            if not objects:
                return {'enabled': False}
            signer_obj = objects[0]
            entries = []
            for entry in signer_obj.get('SignerEntries', []):
                se = entry.get('SignerEntry', {})
                entries.append({
                    'account': se.get('Account', ''),
                    'weight': se.get('SignerWeight', 1)
                })
            quorum = signer_obj.get('SignerQuorum', 0)
            return {
                'enabled': True,
                'quorum': quorum,
                'signers': entries,
            }
        except Exception as exc:
            return {'enabled': False, 'error': str(exc)}

    def estimate_signer_list_cost(self, signer_count: int) -> Dict:
        info = self.get_network_info()
        reserve_base = Decimal(str(info.get('reserve_base', 0)))
        reserve_inc = Decimal(str(info.get('reserve_inc', 0)))
        additional = reserve_inc * Decimal(max(signer_count, 0))
        total = reserve_base + additional
        return {
            'reserve_base': float(reserve_base),
            'reserve_increment': float(reserve_inc),
            'signer_count': signer_count,
            'additional_reserve': float(additional),
            'total_reserve': float(total),
        }

    def prepare_payment_transaction(
        self,
        destination: str,
        amount_xrp: str,
        memo: Optional[str] = None,
        destination_tag: Optional[int] = None,
    ) -> Dict:
        if not self.wallet:
            raise ValueError("No wallet loaded")

        amount_drops = self._xrp_to_drops(amount_xrp)
        payment = Payment(
            account=self.wallet.address,
            destination=destination,
            amount=amount_drops,
            destination_tag=destination_tag,
        )

        if memo:
            payment.memos = [{
                "Memo": {
                    "MemoData": memo.encode('utf-8').hex()
                }
            }]

        tx_json = payment.to_xrpl()
        tx_json.pop('SigningPubKey', None)
        tx_json.pop('TxnSignature', None)
        return tx_json

    @staticmethod
    def _xrp_to_drops(amount: str) -> str:
        return str(xrp_to_drops(Decimal(amount)))
    @staticmethod
    @staticmethod
    def _format_fee(fee) -> str:
        try:
            return f"{drops_to_xrp(str(fee)).quantize(Decimal('0.000001'))}"
        except Exception:
            return str(fee)

    @staticmethod
    def _parse_date(value) -> str:
        if value is None:
            return "Unknown"
        if isinstance(value, (int, float)):
            try:
                return datetime.fromtimestamp(value).strftime("%Y-%m-%d %H:%M:%S")
            except Exception:
                return str(value)
        value_str = str(value)
        if value_str.endswith('Z'):
            value_str = value_str[:-1]
        if 'T' in value_str:
            value_str = value_str.replace('T', ' ')
        if value_str.endswith('.000'):
            value_str = value_str[:-4]
        return value_str

    @staticmethod
    def _extract_value(data: Dict, keys: List[str]) -> Optional[str]:
        for key in keys:
            if key in data and data[key] not in (None, ''):
                return data[key]
        return None
