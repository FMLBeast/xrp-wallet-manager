/**
 * Web Worker for PBKDF2 key derivation
 * Prevents UI blocking during expensive crypto operations
 */

// Import CryptoJS for the worker context
importScripts('https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.2.0/crypto-js.min.js');

// Security constants
const PBKDF2_ITERATIONS = 390000;

/**
 * Derive key from password using PBKDF2-SHA256
 */
function deriveKey(password, saltHex) {
  const salt = CryptoJS.enc.Hex.parse(saltHex);
  return CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations: PBKDF2_ITERATIONS,
    hasher: CryptoJS.algo.SHA256
  });
}

// Listen for messages from main thread
self.addEventListener('message', function(e) {
  const { type, data, id } = e.data;

  try {
    switch (type) {
      case 'DERIVE_KEY':
        const { password, saltHex } = data;
        const startTime = Date.now();

        // Perform key derivation
        const key = deriveKey(password, saltHex);
        const derivationTime = Date.now() - startTime;

        // Send result back to main thread
        self.postMessage({
          type: 'DERIVE_KEY_SUCCESS',
          id,
          data: {
            keyHex: key.toString(CryptoJS.enc.Hex),
            derivationTime
          }
        });
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    // Send error back to main thread
    self.postMessage({
      type: 'DERIVE_KEY_ERROR',
      id,
      error: error.message
    });
  }
});

// Send ready signal
self.postMessage({ type: 'WORKER_READY' });