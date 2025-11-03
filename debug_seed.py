#!/usr/bin/env python3
"""
Debug seed format and test conversion
"""

import sys
from xrp_wallet import create_wallet_from_secret

def debug_seed_format(seed_input):
    """Debug what's happening with the seed"""
    print(f"🔍 Debugging seed format...")
    print(f"Input: {seed_input}")
    print(f"Length: {len(seed_input)}")
    print(f"Starts with 's': {seed_input.startswith('s')}")

    try:
        wallet, info = create_wallet_from_secret(seed_input)
        masked_private = f"{info.private_key[:6]}...{info.private_key[-4:]}"
        print(f"\n✅ Secret is valid!")
        print(f"Address: {wallet.address}")
        print(f"Algorithm: {info.algorithm.value}")
        print(f"Secret type: {info.secret_type}")
        print(f"Private key (masked): {masked_private}")

    except Exception as e:
        print(f"❌ Secret validation failed: {e}")
        print(f"Your seed might be invalid or in wrong format")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        debug_seed_format(sys.argv[1])
    else:
        print("Usage: python debug_seed.py 'your_seed_here'")
        print("Example: python debug_seed.py 'sEdT...'")
