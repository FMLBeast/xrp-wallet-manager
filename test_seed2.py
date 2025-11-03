#!/usr/bin/env python3
"""
Generate a valid test seed and test conversion
"""

from xrpl.wallet import Wallet

def test_valid_seed():
    """Generate and test with a valid seed"""
    print("Generating a valid test wallet...")

    try:
        # Generate a new wallet
        wallet = Wallet.create()
        print(f"Generated wallet address: {wallet.address}")
        print(f"Generated private key: {wallet.private_key}")
        print(f"Private key type: {type(wallet.private_key)}")
        print(f"Private key length: {len(wallet.private_key)}")

        # Test creating from the private key
        wallet2 = Wallet.from_secret(wallet.private_key)
        print(f"Recreated wallet address: {wallet2.address}")
        print(f"Addresses match: {wallet.address == wallet2.address}")

        # Show what a seed looks like
        print(f"\n🔑 This is what a valid private key looks like:")
        print(f"Format: 64-character hex string")
        print(f"Example: {wallet.private_key}")

        return wallet.private_key

    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return None

def test_with_your_format(hex_key):
    """Test what happens when we use the hex key"""
    print(f"\n🧪 Testing wallet creation with hex key...")
    try:
        wallet = Wallet.from_secret(hex_key)
        print(f"✅ Success! Address: {wallet.address}")
        return True
    except Exception as e:
        print(f"❌ Failed: {e}")
        return False

if __name__ == "__main__":
    hex_key = test_valid_seed()
    if hex_key:
        test_with_your_format(hex_key)