#!/usr/bin/env python3
"""
Test seed conversion to debug the issue
"""

from xrpl.wallet import Wallet

def test_seed_conversion():
    """Test seed conversion"""
    print("Testing seed conversion...")

    # Test with a known working seed
    test_seed = "sEdTM1uX8pu2do5XvTnutH6HsNj7UDN"  # Example seed

    try:
        print(f"Input seed: {test_seed}")

        # Method 1: from_seed
        wallet1 = Wallet.from_seed(test_seed)
        print(f"from_seed address: {wallet1.address}")
        print(f"from_seed private_key: {wallet1.private_key}")
        print(f"Private key type: {type(wallet1.private_key)}")
        print(f"Private key length: {len(wallet1.private_key)}")

        # Method 2: from_secret with the private key
        wallet2 = Wallet.from_secret(wallet1.private_key)
        print(f"from_secret address: {wallet2.address}")
        print(f"Addresses match: {wallet1.address == wallet2.address}")

        print("✅ Test successful!")
        return wallet1.private_key

    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    test_seed_conversion()