#!/usr/bin/env python3
"""
XRP Private Key Format Converter
Helps convert between different XRP private key formats
"""

import re
from xrpl.wallet import Wallet
from xrpl.core.keypairs import derive_keypair
from xrpl.core.addresscodec import encode_seed, decode_seed
import binascii

def analyze_key_format(key_input):
    """Analyze the format of the provided key"""
    key_input = key_input.strip()

    print(f"🔍 Analyzing key: {key_input[:8]}...{key_input[-8:] if len(key_input) > 16 else ''}")
    print(f"📏 Length: {len(key_input)} characters")

    # Check different formats
    formats = []

    # 1. Check if it's a 64-character hex string
    if len(key_input) == 64 and all(c in '0123456789abcdefABCDEF' for c in key_input):
        formats.append("64-char hex (raw private key)")
        return key_input.lower(), formats

    # 2. Check if it's an XRP seed (starts with 's')
    if key_input.startswith('s') and len(key_input) >= 25:
        formats.append("XRP seed format (s...)")
        try:
            # Try to convert seed to hex
            seed_bytes = decode_seed(key_input)
            hex_key = seed_bytes.hex()
            if len(hex_key) == 64:
                formats.append(f"Converted to hex: {hex_key}")
                return hex_key, formats
        except Exception as e:
            formats.append(f"Invalid seed format: {e}")

    # 3. Check if it's a different hex length
    if all(c in '0123456789abcdefABCDEF' for c in key_input):
        formats.append(f"Hex format but wrong length ({len(key_input)} chars, need 64)")

        # Try to pad or interpret
        if len(key_input) < 64:
            padded = key_input.zfill(64)
            formats.append(f"Zero-padded version: {padded}")
            return padded, formats

    # 4. Check if it contains spaces or dashes (remove them)
    clean_key = re.sub(r'[^0-9a-fA-F]', '', key_input)
    if clean_key != key_input:
        formats.append(f"Cleaned version (removed non-hex): {clean_key}")
        if len(clean_key) == 64:
            formats.append("✅ Valid after cleaning")
            return clean_key.lower(), formats

    formats.append("❌ Unknown or invalid format")
    return None, formats

def convert_key_format(key_input):
    """Convert key to the required 64-character hex format"""
    try:
        converted_key, formats = analyze_key_format(key_input)

        print("📋 Analysis Results:")
        for fmt in formats:
            print(f"  • {fmt}")

        if converted_key:
            print(f"\n✅ Converted key: {converted_key}")

            # Verify the key works by creating a wallet
            try:
                test_wallet = Wallet.from_secret(converted_key)
                print(f"🎯 Wallet address: {test_wallet.address}")
                print(f"✅ Key is valid!")
                return converted_key
            except Exception as e:
                print(f"❌ Key validation failed: {e}")
                return None
        else:
            print("\n❌ Could not convert to valid format")
            return None

    except Exception as e:
        print(f"❌ Conversion error: {e}")
        return None

def main():
    """Interactive key converter"""
    print("🔑 XRP Private Key Format Converter")
    print("=" * 40)

    while True:
        print("\nEnter your private key (or 'quit' to exit):")
        key_input = input("Key: ").strip()

        if key_input.lower() in ['quit', 'exit', 'q']:
            break

        if not key_input:
            continue

        print("\n" + "─" * 40)
        converted = convert_key_format(key_input)

        if converted:
            print(f"\n🎉 Use this key in the app: {converted}")
        else:
            print("\n💡 Suggestions:")
            print("  • Make sure it's a valid XRP private key")
            print("  • Try removing any spaces or special characters")
            print("  • If it's a seed (starts with 's'), make sure it's correctly formatted")
            print("  • Check if it's from a wallet backup file")

        print("─" * 40)

if __name__ == "__main__":
    main()