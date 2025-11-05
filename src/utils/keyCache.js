/**
 * Key cache manager for performance optimization
 * Caches the derived encryption key to avoid expensive PBKDF2 operations
 */

import CryptoJS from 'crypto-js';

// Security constants matching encryption.js
const PBKDF2_ITERATIONS = 390000;

// In-memory key cache
let cachedKey = null;
let cachedSalt = null;

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
 * Cache the derived key for the current session
 * This avoids expensive PBKDF2 operations on every wallet operation
 */
export function cacheKey(password, salt) {
  console.log('[KeyCache] Deriving and caching encryption key...');
  const startTime = Date.now();

  cachedKey = deriveKey(password, salt);
  cachedSalt = salt;

  const derivationTime = Date.now() - startTime;
  console.log(`[KeyCache] Key derived and cached in ${derivationTime}ms`);

  return cachedKey;
}

/**
 * Get the cached key if available
 */
export function getCachedKey() {
  return cachedKey;
}

/**
 * Get the cached salt if available
 */
export function getCachedSalt() {
  return cachedSalt;
}

/**
 * Check if a key is cached
 */
export function hasKey() {
  return cachedKey !== null;
}

/**
 * Clear the cached key (on logout/lock)
 */
export function clearKey() {
  console.log('[KeyCache] Clearing cached encryption key');
  cachedKey = null;
  cachedSalt = null;
}

/**
 * Verify that the cached key matches the provided password
 * This is used to ensure cache integrity
 */
export function verifyCachedKey(password) {
  if (!hasKey() || !cachedSalt) {
    return false;
  }

  const testKey = deriveKey(password, cachedSalt);
  return testKey.toString() === cachedKey.toString();
}