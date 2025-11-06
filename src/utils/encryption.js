/**
 * Encryption utilities for wallet data
 * Replicates the Python version's security model with PBKDF2-SHA256 and HMAC-based stream cipher
 */

import CryptoJS from 'crypto-js';
import { getCachedKey, getCachedSalt, hasKey } from './keyCache.js';

// Security constants matching Python version
// Use fewer iterations in test environment for performance
const PBKDF2_ITERATIONS = process.env.NODE_ENV === 'test' ? 1000 : 390000;
const SALT_LENGTH = 32;
const NONCE_LENGTH = 12;

/**
 * Generate cryptographically secure random bytes
 */
function generateRandomBytes(length) {
  return CryptoJS.lib.WordArray.random(length);
}

/**
 * Derive key from password using PBKDF2-SHA256
 */
function deriveKey(password, salt) {
  return CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations: PBKDF2_ITERATIONS,
    hasher: CryptoJS.algo.SHA256
  });
}

/**
 * Encrypt data using HMAC-based stream cipher
 * Matches the Python version's encryption scheme
 * Uses cached key for performance when available
 */
export function encryptData(password, plaintext) {
  // Validate inputs
  if (password === null || password === undefined) {
    throw new Error('Password cannot be null or undefined');
  }
  if (plaintext === null || plaintext === undefined) {
    throw new Error('Plaintext cannot be null or undefined');
  }

  // Convert plaintext to bytes
  const plaintextBytes = CryptoJS.enc.Utf8.parse(plaintext);

  let key, salt;

  // Use cached key for performance if available
  if (hasKey()) {
    console.log('[Encrypt] Using cached encryption key');
    key = getCachedKey();
    salt = getCachedSalt();
  } else {
    // Fallback to password-based key derivation
    console.log('[Encrypt] No cached key, deriving from password...');
    console.log('[Encrypt] Password length:', password.length);
    console.log('[Encrypt] Has leading space:', password[0] === ' ');
    console.log('[Encrypt] Has trailing space:', password[password.length - 1] === ' ');

    // Generate random salt and derive key
    salt = generateRandomBytes(SALT_LENGTH);
    key = deriveKey(password, salt);
  }

  // Generate random nonce
  const nonce = generateRandomBytes(NONCE_LENGTH);

  // Create HMAC key from derived key
  const hmacKey = CryptoJS.HmacSHA256(nonce, key);

  // Encrypt using AES-CTR mode (simulating stream cipher)
  const encrypted = CryptoJS.AES.encrypt(plaintextBytes, hmacKey, {
    mode: CryptoJS.mode.CTR,
    iv: nonce,
    padding: CryptoJS.pad.NoPadding
  });

  const ciphertext = encrypted.ciphertext;

  // Calculate MAC using manual hex concatenation for consistency
  const saltHex = salt.toString(CryptoJS.enc.Hex);
  const nonceHex = nonce.toString(CryptoJS.enc.Hex);
  const ciphertextHex = ciphertext.toString(CryptoJS.enc.Hex);
  const macDataHex = saltHex + nonceHex + ciphertextHex;
  const macData = CryptoJS.enc.Hex.parse(macDataHex);

  const mac = CryptoJS.HmacSHA256(macData, key);

  const envelope = {
    salt: salt.toString(CryptoJS.enc.Hex),
    nonce: nonce.toString(CryptoJS.enc.Hex),
    ciphertext: ciphertext.toString(CryptoJS.enc.Hex),
    mac: mac.toString(CryptoJS.enc.Hex)
  };

  console.log('[Encrypt] Successfully encrypted data, MAC:', envelope.mac.substring(0, 16) + '...');

  // Return envelope
  return envelope;
}

/**
 * Decrypt data using HMAC-based stream cipher
 * Matches the Python version's decryption scheme
 */
export function decryptData(password, envelope) {
  try {
    // Parse envelope components
    const salt = CryptoJS.enc.Hex.parse(envelope.salt);
    const nonce = CryptoJS.enc.Hex.parse(envelope.nonce);
    const ciphertext = CryptoJS.enc.Hex.parse(envelope.ciphertext);
    const providedMac = envelope.mac;

    let key;

    // Use cached key if available and salt matches
    if (hasKey() && getCachedSalt() && getCachedSalt().toString() === salt.toString()) {
      console.log('[Decrypt] Using cached encryption key');
      key = getCachedKey();
    } else {
      // Fallback to password-based key derivation
      console.log('[Decrypt] Deriving key from password (salt mismatch or no cache)...');
      console.log('[Decrypt] Password length:', password.length);
      console.log('[Decrypt] Has leading space:', password[0] === ' ');
      console.log('[Decrypt] Has trailing space:', password[password.length - 1] === ' ');

      key = deriveKey(password, salt);
    }

    // Verify MAC using manual hex concatenation for consistency
    const saltHex = salt.toString(CryptoJS.enc.Hex);
    const nonceHex = nonce.toString(CryptoJS.enc.Hex);
    const ciphertextHex = ciphertext.toString(CryptoJS.enc.Hex);
    const macDataHex = saltHex + nonceHex + ciphertextHex;
    const macData = CryptoJS.enc.Hex.parse(macDataHex);

    const calculatedMac = CryptoJS.HmacSHA256(macData, key);
    const calculatedMacHex = calculatedMac.toString(CryptoJS.enc.Hex);

    console.log('[Decrypt] MAC verification - Provided:', providedMac.substring(0, 16) + '...');
    console.log('[Decrypt] MAC verification - Calculated:', calculatedMacHex.substring(0, 16) + '...');

    // Use explicit hex comparison for MAC verification
    if (calculatedMacHex !== providedMac) {
      console.error('[Decrypt] MAC verification failed - password mismatch');
      throw new Error('Invalid password or corrupted data');
    }

    console.log('[Decrypt] MAC verification passed');

    // Create HMAC key for decryption
    const hmacKey = CryptoJS.HmacSHA256(nonce, key);

    // Decrypt
    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext: ciphertext },
      hmacKey,
      {
        mode: CryptoJS.mode.CTR,
        iv: nonce,
        padding: CryptoJS.pad.NoPadding
      }
    );

    // Convert back to UTF-8 string
    const plaintext = decrypted.toString(CryptoJS.enc.Utf8);

    if (!plaintext) {
      throw new Error('Decryption failed - invalid password');
    }

    console.log('[Decrypt] Successfully decrypted data');
    return plaintext;
  } catch (error) {
    console.error('[Decrypt] Error:', error.message);
    if (error.message.includes('Invalid password')) {
      throw error;
    }
    throw new Error('Decryption failed: ' + error.message);
  }
}

/**
 * Decrypt data from Python wallet format with fallback compatibility
 */
export function decryptPythonWalletData(password, envelope) {
  // First try the standard decryption
  try {
    return decryptData(password, envelope);
  } catch (error) {
    console.log('Standard decryption failed, trying Python compatibility mode:', error.message);

    // Try Python compatibility mode with different key derivation
    try {
      const salt = CryptoJS.enc.Hex.parse(envelope.salt);
      const nonce = CryptoJS.enc.Hex.parse(envelope.nonce);
      const ciphertext = CryptoJS.enc.Hex.parse(envelope.ciphertext);
      const providedMac = envelope.mac;

      // Try different PBKDF2 parameters that might match Python
      const keyAlt = CryptoJS.PBKDF2(password, salt, {
        keySize: 256 / 32,
        iterations: PBKDF2_ITERATIONS,
        hasher: CryptoJS.algo.SHA256
      });

      // Verify MAC with alternative approach
      const macDataAlt = salt.toString() + nonce.toString() + ciphertext.toString();
      const calculatedMacAlt = CryptoJS.HmacSHA256(macDataAlt, keyAlt);
      const calculatedMacAltHex = calculatedMacAlt.toString(CryptoJS.enc.Hex);

      if (calculatedMacAltHex === providedMac) {
        // Use alternative HMAC key generation
        const hmacKeyAlt = CryptoJS.HmacSHA256(nonce.toString(), keyAlt);

        const decryptedAlt = CryptoJS.AES.decrypt(
          { ciphertext: ciphertext },
          hmacKeyAlt,
          {
            mode: CryptoJS.mode.CTR,
            iv: nonce,
            padding: CryptoJS.pad.NoPadding
          }
        );

        const plaintextAlt = decryptedAlt.toString(CryptoJS.enc.Utf8);
        if (plaintextAlt) {
          console.log('Python compatibility mode succeeded');
          return plaintextAlt;
        }
      }

      throw new Error('All decryption methods failed');
    } catch (compatError) {
      throw new Error('Invalid password or incompatible wallet format');
    }
  }
}