#!/usr/bin/env python3
"""
Quick utility to decrypt Python wallet and show contents for migration
"""

import json
import sys
import getpass
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes, hmac
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import secrets

def decrypt_wallet_file(file_path, password):
    """Decrypt Python wallet file and return wallet data"""
    try:
        with open(file_path, 'r') as f:
            envelope = json.load(f)

        # Parse components
        salt = bytes.fromhex(envelope['salt'])
        nonce = bytes.fromhex(envelope['nonce'])
        ciphertext = bytes.fromhex(envelope['ciphertext'])
        provided_mac = envelope['mac']

        # Derive key using PBKDF2-SHA256
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=390000,
            backend=default_backend()
        )
        key = kdf.derive(password.encode('utf-8'))

        # Verify MAC
        mac_data = salt + nonce + ciphertext
        h = hmac.HMAC(key, hashes.SHA256(), backend=default_backend())
        h.update(mac_data)
        calculated_mac = h.finalize().hex()

        if calculated_mac != provided_mac:
            print("ERROR: Invalid password or corrupted wallet file")
            return None

        # Generate HMAC key for decryption
        h2 = hmac.HMAC(key, hashes.SHA256(), backend=default_backend())
        h2.update(nonce)
        hmac_key = h2.finalize()

        # Decrypt using AES-CTR
        cipher = Cipher(
            algorithms.AES(hmac_key),
            modes.CTR(nonce),
            backend=default_backend()
        )
        decryptor = cipher.decryptor()
        plaintext = decryptor.update(ciphertext) + decryptor.finalize()

        # Parse JSON
        wallet_data = json.loads(plaintext.decode('utf-8'))
        return wallet_data

    except Exception as e:
        print(f"ERROR: Failed to decrypt wallet: {e}")
        return None

def main():
    wallet_file = "/Users/beast/Library/Application Support/xrp-wallet-manager/wallets.enc.python"

    if not os.path.exists(wallet_file):
        print(f"Wallet file not found: {wallet_file}")
        return

    password = getpass.getpass("Enter your Python wallet master password: ")

    wallet_data = decrypt_wallet_file(wallet_file, password)

    if wallet_data:
        print("\n=== WALLET DATA SUCCESSFULLY DECRYPTED ===")
        print(json.dumps(wallet_data, indent=2))
        print("\n=== END WALLET DATA ===")

        # Save to a readable file
        output_file = "/Users/beast/xrp_wallet_manager/wallet_export.json"
        with open(output_file, 'w') as f:
            json.dump(wallet_data, f, indent=2)
        print(f"\nWallet data exported to: {output_file}")
        print("You can now import this data into the Electron app.")
    else:
        print("Failed to decrypt wallet. Please check your password.")

if __name__ == "__main__":
    import os
    main()