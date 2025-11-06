/**
 * PBKDF2 Web Worker Manager
 * Provides async interface for expensive key derivation operations
 */

import CryptoJS from 'crypto-js';

class PBKDF2WorkerManager {
  constructor() {
    this.worker = null;
    this.pendingRequests = new Map();
    this.requestId = 0;
    this.isReady = false;
  }

  /**
   * Initialize the Web Worker
   */
  async init() {
    if (this.worker) {
      return; // Already initialized
    }

    return new Promise((resolve, reject) => {
      try {
        this.worker = new Worker('/pbkdf2-worker.js');

        this.worker.onmessage = (e) => {
          const { type, id, data, error } = e.data;

          switch (type) {
            case 'WORKER_READY':
              this.isReady = true;
              resolve();
              break;

            case 'DERIVE_KEY_SUCCESS':
              const successCallback = this.pendingRequests.get(id);
              if (successCallback) {
                this.pendingRequests.delete(id);
                successCallback.resolve(data);
              }
              break;

            case 'DERIVE_KEY_ERROR':
              const errorCallback = this.pendingRequests.get(id);
              if (errorCallback) {
                this.pendingRequests.delete(id);
                errorCallback.reject(new Error(error));
              }
              break;

            default:
              console.warn('[PBKDF2Worker] Unknown message type:', type);
          }
        };

        this.worker.onerror = (error) => {
          console.error('[PBKDF2Worker] Worker error:', error);
          reject(new Error('Web Worker failed to initialize'));
        };

        // Set a timeout for worker initialization
        setTimeout(() => {
          if (!this.isReady) {
            reject(new Error('Web Worker initialization timeout'));
          }
        }, 5000);

      } catch (error) {
        console.error('[PBKDF2Worker] Failed to create worker:', error);
        reject(error);
      }
    });
  }

  /**
   * Derive key using Web Worker (async, non-blocking)
   */
  async deriveKey(password, salt) {
    if (!this.worker || !this.isReady) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const saltHex = salt.toString(CryptoJS.enc.Hex);

      // Store the promise callbacks
      this.pendingRequests.set(id, { resolve, reject });

      // Set timeout for the operation (10 seconds max)
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('PBKDF2 derivation timeout after 10 seconds'));
      }, 10000);

      // Override resolve to clear timeout
      const originalResolve = resolve;
      const wrappedResolve = (data) => {
        clearTimeout(timeout);
        originalResolve(data);
      };

      const originalReject = reject;
      const wrappedReject = (error) => {
        clearTimeout(timeout);
        originalReject(error);
      };

      this.pendingRequests.set(id, {
        resolve: wrappedResolve,
        reject: wrappedReject
      });

      // Send message to worker
      this.worker.postMessage({
        type: 'DERIVE_KEY',
        id,
        data: { password, saltHex }
      });
    });
  }

  /**
   * Clean up the worker
   */
  terminate() {
    if (this.worker) {
      // Reject all pending requests
      this.pendingRequests.forEach(({ reject }) => {
        reject(new Error('Worker terminated'));
      });
      this.pendingRequests.clear();

      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
    }
  }

  /**
   * Check if Web Workers are supported
   */
  static isSupported() {
    return typeof Worker !== 'undefined';
  }
}

// Singleton instance
let workerManager = null;

/**
 * Get or create the worker manager instance
 */
export function getWorkerManager() {
  if (!workerManager) {
    workerManager = new PBKDF2WorkerManager();
  }
  return workerManager;
}

/**
 * Derive key using Web Worker (fallback to synchronous if not supported)
 */
export async function deriveKeyAsync(password, salt) {
  if (PBKDF2WorkerManager.isSupported()) {
    try {
      const manager = getWorkerManager();
      const result = await manager.deriveKey(password, salt);

      console.log(`[PBKDF2Worker] Key derived in ${result.derivationTime}ms (async)`);

      // Convert hex string back to CryptoJS WordArray
      return CryptoJS.enc.Hex.parse(result.keyHex);
    } catch (error) {
      console.warn('[PBKDF2Worker] Failed, falling back to sync:', error.message);
    }
  }

  // Fallback to synchronous derivation
  console.warn('[PBKDF2Worker] Using synchronous fallback (will block UI)');
  const startTime = Date.now();
  const key = CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations: 150000,
    hasher: CryptoJS.algo.SHA256
  });
  const derivationTime = Date.now() - startTime;
  console.log(`[PBKDF2Worker] Key derived in ${derivationTime}ms (sync fallback)`);

  return key;
}

/**
 * Clean up the worker manager (call on app shutdown)
 */
export function cleanup() {
  if (workerManager) {
    workerManager.terminate();
    workerManager = null;
  }
}