/**
 * Unit tests for XRPL wallet utilities
 */

import {
  detectAlgorithm,
  detectSecretType,
  createWalletFromSecret,
  formatAmount,
  isValidAddress,
  isValidDestinationTag,
  validateAmount,
  getNetworkConfig,
  getExplorerUrl,
  getAccountExplorerUrl
} from '../xrplWallet';

// Mock XRPL library for testing
jest.mock('xrpl', () => ({
  Client: jest.fn(),
  Wallet: {
    fromSeed: jest.fn(() => ({
      address: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
      publicKey: '0330E7FC9D56BB25D6893BA3F317AE5BCF33B3291BD63DB32654A313222F7FD020',
      seed: 'sEdVkiMHgv2hpvMCGM45jjKCjK5qrJvLR4EQGWhJ6hYvjcY6BtfGN'
    })),
    fromMnemonic: jest.fn(() => ({
      address: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
      publicKey: '0330E7FC9D56BB25D6893BA3F317AE5BCF33B3291BD63DB32654A313222F7FD020'
    }))
  },
  xrpToDrops: jest.fn((xrp) => (parseFloat(xrp) * 1000000).toString()),
  dropsToXrp: jest.fn((drops) => (parseFloat(drops) / 1000000).toString())
}));

describe('XRPL Wallet Utilities', () => {
  describe('detectAlgorithm', () => {
    test('detects ed25519 algorithm from ED prefix', () => {
      const ed25519Seed = 'ED1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF';
      expect(detectAlgorithm(ed25519Seed)).toBe('ed25519');
    });

    test('detects secp256k1 algorithm from hex private key', () => {
      const privateKey = '1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF';
      expect(detectAlgorithm(privateKey)).toBe('secp256k1');
    });

    test('detects secp256k1 algorithm from family seed', () => {
      const familySeed = 'sEd7A7WfL5zLG9vEwSjdKT6LJHsEqgZKGhzaTUvtLFCKX5pS6y';
      expect(detectAlgorithm(familySeed)).toBe('secp256k1');
    });

    test('detects secp256k1 algorithm from mnemonic phrase', () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      expect(detectAlgorithm(mnemonic)).toBe('secp256k1');
    });

    test('detects 24-word mnemonic phrase', () => {
      const mnemonic24 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';
      expect(detectAlgorithm(mnemonic24)).toBe('secp256k1');
    });

    test('throws error for invalid secret format', () => {
      expect(() => detectAlgorithm('invalid-secret')).toThrow('Unrecognized secret format');
      expect(() => detectAlgorithm('')).toThrow('Unrecognized secret format');
      expect(() => detectAlgorithm('abc123')).toThrow('Unrecognized secret format');
    });
  });

  describe('detectSecretType', () => {
    test('detects seed type for ed25519', () => {
      const ed25519Seed = 'ED1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF';
      expect(detectSecretType(ed25519Seed)).toBe('seed');
    });

    test('detects private_key type for hex private key', () => {
      const privateKey = '1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF';
      expect(detectSecretType(privateKey)).toBe('private_key');
    });

    test('detects seed type for family seed', () => {
      const familySeed = 'sEd7A7WfL5zLG9vEwSjdKT6LJHsEqgZKGhzaTUvtLFCKX5pS6y';
      expect(detectSecretType(familySeed)).toBe('seed');
    });

    test('detects mnemonic type for word phrases', () => {
      const mnemonic12 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const mnemonic24 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';
      expect(detectSecretType(mnemonic12)).toBe('mnemonic');
      expect(detectSecretType(mnemonic24)).toBe('mnemonic');
    });

    test('throws error for invalid secret format', () => {
      expect(() => detectSecretType('invalid-secret')).toThrow('Unrecognized secret format');
    });
  });

  describe('createWalletFromSecret', () => {
    test('creates wallet from family seed', () => {
      const familySeed = 'sEdVkiMHgv2hpvMCGM45jjKCjK5qrJvLR4EQGWhJ6hYvjcY6BtfGN';
      const result = createWalletFromSecret(familySeed);

      expect(result).toHaveProperty('address');
      expect(result).toHaveProperty('public_key');
      expect(result).toHaveProperty('secret_type', 'seed');
      expect(result).toHaveProperty('algorithm', 'secp256k1');
      expect(result).toHaveProperty('suggested_name');
      expect(result.suggested_name).toMatch(/^Wallet-/);
    });

    test('creates wallet from mnemonic phrase', () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const result = createWalletFromSecret(mnemonic);

      expect(result).toHaveProperty('address');
      expect(result).toHaveProperty('public_key');
      expect(result).toHaveProperty('secret_type', 'mnemonic');
      expect(result).toHaveProperty('algorithm', 'secp256k1');
      expect(result).toHaveProperty('suggested_name');
    });

    test('throws error for invalid secret', () => {
      expect(() => createWalletFromSecret('invalid-secret')).toThrow('Invalid wallet secret');
    });

    test('trims whitespace from secret', () => {
      const familySeed = '  sEdVkiMHgv2hpvMCGM45jjKCjK5qrJvLR4EQGWhJ6hYvjcY6BtfGN  ';
      const result = createWalletFromSecret(familySeed);
      expect(result).toHaveProperty('address');
    });
  });

  describe('formatAmount', () => {
    test('converts drops to XRP', () => {
      expect(formatAmount('1000000')).toBe('1');
      expect(formatAmount('2500000')).toBe('2.5');
      expect(formatAmount('1234567')).toBe('1.234567');
    });

    test('handles zero drops', () => {
      expect(formatAmount('0')).toBe('0');
    });

    test('returns input for non-string or zero values', () => {
      expect(formatAmount(0)).toBe(0);
      expect(formatAmount(null)).toBe(null);
      expect(formatAmount(undefined)).toBe(undefined);
    });
  });

  describe('isValidAddress', () => {
    test('validates correct XRP addresses', () => {
      expect(isValidAddress('rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH')).toBe(true);
      expect(isValidAddress('rUn84CJzdHmV3QpNfkp6gQCqGCqjTpUCa')).toBe(true);
      expect(isValidAddress('rnUy2SHTrB9DubsPmkv6zAHonjkkDHGN4wm')).toBe(true);
    });

    test('rejects invalid XRP addresses', () => {
      expect(isValidAddress('invalid-address')).toBe(false);
      expect(isValidAddress('1234567890')).toBe(false);
      expect(isValidAddress('rTooShort')).toBe(false);
      expect(isValidAddress('xN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH')).toBe(false); // Wrong prefix
      expect(isValidAddress('')).toBe(false);
      expect(isValidAddress(null)).toBe(false);
    });
  });

  describe('isValidDestinationTag', () => {
    test('validates correct destination tags', () => {
      expect(isValidDestinationTag('123')).toBe(true);
      expect(isValidDestinationTag('0')).toBe(true);
      expect(isValidDestinationTag('4294967295')).toBe(true); // Max 32-bit unsigned
      expect(isValidDestinationTag(123)).toBe(true);
    });

    test('accepts empty or null tags', () => {
      expect(isValidDestinationTag('')).toBe(true);
      expect(isValidDestinationTag(null)).toBe(true);
      expect(isValidDestinationTag(undefined)).toBe(true);
    });

    test('rejects invalid destination tags', () => {
      expect(isValidDestinationTag('-1')).toBe(false);
      expect(isValidDestinationTag('4294967296')).toBe(false); // Over 32-bit max
      expect(isValidDestinationTag('abc')).toBe(false);
      expect(isValidDestinationTag('12.34')).toBe(false);
    });
  });

  describe('validateAmount', () => {
    test('validates correct amounts', () => {
      expect(validateAmount('1')).toEqual({ isValid: true });
      expect(validateAmount('0.000001')).toEqual({ isValid: true });
      expect(validateAmount('1000000')).toEqual({ isValid: true });
      expect(validateAmount('123.456789')).toEqual({ isValid: true });
    });

    test('rejects invalid amounts', () => {
      expect(validateAmount('')).toEqual({ isValid: false, error: 'Amount is required' });
      expect(validateAmount('0')).toEqual({ isValid: false, error: 'Amount is required' });
      expect(validateAmount('-1')).toEqual({ isValid: false, error: 'Amount must be a positive number' });
      expect(validateAmount('abc')).toEqual({ isValid: false, error: 'Amount must be a positive number' });
      expect(validateAmount('0.0000001')).toEqual({ isValid: false, error: 'Amount is too small (minimum 0.000001 XRP)' });
      expect(validateAmount('100000000001')).toEqual({ isValid: false, error: 'Amount is too large' });
    });
  });

  describe('getNetworkConfig', () => {
    test('returns mainnet configuration', () => {
      const config = getNetworkConfig('mainnet');
      expect(config).toEqual({
        name: 'Mainnet',
        server: 'wss://xrplcluster.com',
        explorer: 'https://livenet.xrpl.org',
        color: 'primary'
      });
    });

    test('returns testnet configuration', () => {
      const config = getNetworkConfig('testnet');
      expect(config).toEqual({
        name: 'Testnet',
        server: 'wss://s.altnet.rippletest.net:51233',
        explorer: 'https://testnet.xrpl.org',
        color: 'secondary'
      });
    });

    test('returns devnet configuration', () => {
      const config = getNetworkConfig('devnet');
      expect(config).toEqual({
        name: 'Devnet',
        server: 'wss://s.devnet.rippletest.net:51233',
        explorer: 'https://devnet.xrpl.org',
        color: 'warning'
      });
    });

    test('returns testnet as default for unknown network', () => {
      const config = getNetworkConfig('unknown');
      expect(config.name).toBe('Testnet');
    });
  });

  describe('getExplorerUrl', () => {
    test('generates mainnet explorer URLs', () => {
      const url = getExplorerUrl('mainnet', 'ABC123');
      expect(url).toBe('https://livenet.xrpl.org/transactions/ABC123');
    });

    test('generates testnet explorer URLs', () => {
      const url = getExplorerUrl('testnet', 'DEF456');
      expect(url).toBe('https://testnet.xrpl.org/transactions/DEF456');
    });

    test('generates devnet explorer URLs', () => {
      const url = getExplorerUrl('devnet', 'GHI789');
      expect(url).toBe('https://devnet.xrpl.org/transactions/GHI789');
    });

    test('defaults to testnet for unknown network', () => {
      const url = getExplorerUrl('unknown', 'JKL012');
      expect(url).toBe('https://testnet.xrpl.org/transactions/JKL012');
    });
  });

  describe('getAccountExplorerUrl', () => {
    test('generates mainnet account URLs', () => {
      const url = getAccountExplorerUrl('mainnet', 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH');
      expect(url).toBe('https://livenet.xrpl.org/accounts/rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH');
    });

    test('generates testnet account URLs', () => {
      const url = getAccountExplorerUrl('testnet', 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH');
      expect(url).toBe('https://testnet.xrpl.org/accounts/rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH');
    });

    test('defaults to testnet for unknown network', () => {
      const url = getAccountExplorerUrl('unknown', 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH');
      expect(url).toBe('https://testnet.xrpl.org/accounts/rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH');
    });
  });
});