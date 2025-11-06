/**
 * Key cache manager for performance optimization
 * Caches the derived encryption key to avoid expensive PBKDF2 operations
 */

import { deriveKeyAsync } from './pbkdf2Worker.js';

// PBKDF2 operations now handled in Web Worker

// In-memory key cache
let cachedKey = null;
let cachedSalt = null;

// Old synchronous deriveKey function removed - now using async Web Worker version

/**
 * Cache the derived key for the current session
 * This avoids expensive PBKDF2 operations on every wallet operation
 */
export async function cacheKey(password, salt) {
  console.log('[KeyCache] Deriving and caching encryption key using Web Worker...');
  const startTime = Date.now();

  cachedKey = await deriveKeyAsync(password, salt);
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
export async function verifyCachedKey(password) {
  if (!hasKey() || !cachedSalt) {
    return false;
  }

  const testKey = await deriveKeyAsync(password, cachedSalt);
  return testKey.toString() === cachedKey.toString();
}