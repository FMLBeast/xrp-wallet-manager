#!/usr/bin/env python3
"""
Test the correct way to handle XRP wallet creation
"""

from xrpl.wallet import Wallet
from xrpl.core.keypairs import derive_keypair, sign
from xrpl.core.addresscodec import encode_seed
import secrets

def test_wallet_methods():
    """Test different wallet creation methods"""
    print("Testing XRP wallet creation methods...")

    # Method 1: Create a new wallet
    print("\n1. Creating new wallet...")
    wallet1 = Wallet.create()
    print(f"Address: {wallet1.address}")
    print(f"Private key (hex): {wallet1.private_key}")
    print(f"Public key: {wallet1.public_key}")

    # Method 2: Test creating from hex private key using internal methods
    print("\n2. Testing hex private key...")
    try:
        # Try using the Wallet constructor directly
        wallet2 = Wallet(wallet1.public_key, wallet1.private_key)
        print(f"✅ Success with constructor!")
        print(f"Address: {wallet2.address}")
        print(f"Addresses match: {wallet1.address == wallet2.address}")
    except Exception as e:
        print(f"❌ Constructor failed: {e}")

    # Method 3: Test what from_secret expects
    print(f"\n3. Testing what from_secret expects...")
    try:
        # Generate a proper seed
        seed_bytes = secrets.token_bytes(16)
        seed = encode_seed(seed_bytes, "secp256k1")
        print(f"Generated seed: {seed}")

        wallet3 = Wallet.from_seed(seed)
        print(f"✅ from_seed works with: {seed}")
        print(f"Address: {wallet3.address}")
        print(f"Private key: {wallet3.private_key}")

    except Exception as e:
        print(f"❌ from_seed failed: {e}")

if __name__ == "__main__":
    test_wallet_methods()