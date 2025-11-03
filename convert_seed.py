#!/usr/bin/env python3
"""
XRP Seed Validator
Validate an XRP seed (s...) or private key and display basic details.
"""

import sys

from xrp_wallet import create_wallet_from_secret


def inspect_secret(secret: str):
    """Validate a seed or private key without exposing the full secret."""
    try:
        wallet, info = create_wallet_from_secret(secret)
    except ValueError as exc:
        print(f"❌ Invalid secret: {exc}")
        return None

    masked_secret = (
        f"{info.secret[:6]}...{info.secret[-4:]}" if len(info.secret) > 10 else "(short secret)"
    )
    masked_private = (
        f"{info.private_key[:6]}...{info.private_key[-4:]}"
        if len(info.private_key) > 10
        else "(short key)"
    )

    print("✅ Secret is valid!")
    print(f"🔒 Stored format: {info.secret_type}")
    print(f"⚙️  Algorithm: {info.algorithm.value}")
    print(f"🏦 Address: {wallet.address}")
    print(f"🔐 Secret (masked): {masked_secret}")
    print(f"🗝️  Private key (masked): {masked_private}")

    return info


if __name__ == "__main__":
    print("🔑 XRP Seed Validator")
    print("Check that your seed or private key is usable by the wallet app.")
    print("-" * 50)

    if len(sys.argv) > 1:
        inspect_secret(sys.argv[1])
    else:
        print("Usage:")
        print(f"  python {sys.argv[0]} 'sYourSeedHere'")
        print("\n⚠️  SECURITY: Run this in a private session; the secret remains in your shell history.")
