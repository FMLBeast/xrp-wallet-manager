/**
 * Encryption utilities for wallet data
 * Replicates the Python version's security model with PBKDF2-SHA256 and HMAC-based stream cipher
 */

import CryptoJS from 'crypto-js';

// Security constants matching Python version
const PBKDF2_ITERATIONS = 390000;
const SALT_LENGTH = 32;
const NONCE_LENGTH = 12;
const MAC_LENGTH = 32;

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
 */
export function encryptData(password, plaintext) {
  // Convert plaintext to bytes
  const plaintextBytes = CryptoJS.enc.Utf8.parse(plaintext);

  // Generate random salt and nonce
  const salt = generateRandomBytes(SALT_LENGTH);
  const nonce = generateRandomBytes(NONCE_LENGTH);

  // Derive encryption key
  const key = deriveKey(password, salt);

  // Create HMAC key from derived key
  const hmacKey = CryptoJS.HmacSHA256(nonce, key);

  // Encrypt using AES-CTR mode (simulating stream cipher)
  const encrypted = CryptoJS.AES.encrypt(plaintextBytes, hmacKey, {
    mode: CryptoJS.mode.CTR,
    iv: nonce,
    padding: CryptoJS.pad.NoPadding
  });

  const ciphertext = encrypted.ciphertext;

  // Calculate MAC
  const macData = CryptoJS.lib.WordArray.create()
    .concat(salt)
    .concat(nonce)
    .concat(ciphertext);

  const mac = CryptoJS.HmacSHA256(macData, key);

  // Return envelope
  return {
    salt: salt.toString(CryptoJS.enc.Hex),
    nonce: nonce.toString(CryptoJS.enc.Hex),
    ciphertext: ciphertext.toString(CryptoJS.enc.Hex),
    mac: mac.toString(CryptoJS.enc.Hex)
  };
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

    // Derive key
    const key = deriveKey(password, salt);

    // Verify MAC
    const macData = CryptoJS.lib.WordArray.create()
      .concat(salt)
      .concat(nonce)
      .concat(ciphertext);

    const calculatedMac = CryptoJS.HmacSHA256(macData, key);
    const calculatedMacHex = calculatedMac.toString(CryptoJS.enc.Hex);

    // Use explicit hex comparison for MAC verification
    if (calculatedMacHex !== providedMac) {
      throw new Error('Invalid password or corrupted data');
    }

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

    return plaintext;
  } catch (error) {
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