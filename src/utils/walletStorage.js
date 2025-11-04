/**
 * Wallet storage manager for renderer process
 * Communicates with main process through IPC for file operations
 */

import { encryptData, decryptData, decryptPythonWalletData } from './encryption';

const STORAGE_VERSION = 1;

/**
 * Check if wallets file exists
 */
export async function walletsFileExists() {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }

  try {
    // Use IPC to check if file exists in main process
    const result = await window.electronAPI.invoke('wallet-storage-exists');
    return result;
  } catch (error) {
    throw new Error(`Failed to check if wallets file exists: ${error.message}`);
  }
}

/**
 * Create empty wallet storage structure
 */
function createEmptyStorage() {
  return {
    wallets: {},
    active_wallet: null,
    address_book: []
  };
}

/**
 * Load and decrypt wallet storage
 * Returns decrypted wallet data or null if file doesn't exist
 */
export async function loadWalletStorage(masterPassword) {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }

  try {
    // Get encrypted data from main process
    const encryptedData = await window.electronAPI.invoke('wallet-storage-load');

    if (!encryptedData) {
      return createEmptyStorage();
    }

    const envelope = JSON.parse(encryptedData);

    // Detect wallet format
    let decryptedJson;

    if (envelope.version === STORAGE_VERSION) {
      // New Electron format
      decryptedJson = decryptData(masterPassword, envelope);
    } else {
      // Legacy Python format or old version - try Python compatibility
      console.log('Detected legacy wallet format, attempting Python compatibility mode');
      decryptedJson = decryptPythonWalletData(masterPassword, envelope);

      // If successful, this will be migrated to new format on next save
      console.log('Successfully decrypted legacy wallet, will migrate format on next save');
    }

    const walletData = JSON.parse(decryptedJson);

    // Ensure required fields exist and normalize structure
    return {
      wallets: walletData.wallets || {},
      active_wallet: walletData.active_wallet || null,
      address_book: walletData.address_book || []
    };
  } catch (error) {
    console.error('loadWalletStorage error details:', error);

    if (error.message.includes('Invalid password') || error.message.includes('incompatible wallet format')) {
      throw new Error('Invalid master password');
    }

    // Provide more specific error information
    if (error.message.includes('ENOENT') || error.message.includes('File not found')) {
      throw new Error('Wallet storage file not found - this might be the first wallet import');
    }

    throw new Error(`Failed to load wallet storage: ${error.message}`);
  }
}

/**
 * Encrypt and save wallet storage
 */
export async function saveWalletStorage(masterPassword, walletData) {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }

  try {
    const jsonData = JSON.stringify(walletData, null, 2);
    const envelope = encryptData(masterPassword, jsonData);

    // Add version to envelope
    envelope.version = STORAGE_VERSION;

    const encryptedJson = JSON.stringify(envelope, null, 2);

    // Save through main process
    const result = await window.electronAPI.invoke('wallet-storage-save', encryptedJson);
    return result;
  } catch (error) {
    throw new Error(`Failed to save wallet storage: ${error.message}`);
  }
}

/**
 * Add or update a wallet
 */
export async function addWallet(masterPassword, walletInfo) {
  if (!masterPassword) {
    throw new Error('Master password is required for adding wallets');
  }

  console.log('addWallet: Attempting to load wallet storage...');
  try {
    const storage = await loadWalletStorage(masterPassword);
    console.log('addWallet: Successfully loaded wallet storage');
    return await _addWalletToStorage(masterPassword, walletInfo, storage);
  } catch (error) {
    console.error('addWallet: Failed to load wallet storage:', error.message);
    throw error;
  }
}

async function _addWalletToStorage(masterPassword, walletInfo, storage) {
  // Add wallet to storage
  storage.wallets[walletInfo.name] = {
    name: walletInfo.name,
    network: walletInfo.network,
    address: walletInfo.address,
    secret: walletInfo.secret,
    secret_type: walletInfo.secret_type,
    public_key: walletInfo.public_key,
    algorithm: walletInfo.algorithm,
    balance: walletInfo.balance || '0',
    created_at: new Date().toISOString()
  };

  // Set as active if it's the first wallet
  if (!storage.active_wallet) {
    storage.active_wallet = walletInfo.name;
  }

  await saveWalletStorage(masterPassword, storage);
  return storage;
}

/**
 * Remove a wallet
 */
export async function removeWallet(masterPassword, walletName) {
  const storage = await loadWalletStorage(masterPassword);

  if (!storage.wallets[walletName]) {
    throw new Error(`Wallet '${walletName}' not found`);
  }

  delete storage.wallets[walletName];

  // Update active wallet if removed wallet was active
  if (storage.active_wallet === walletName) {
    const remainingWallets = Object.keys(storage.wallets);
    storage.active_wallet = remainingWallets.length > 0 ? remainingWallets[0] : null;
  }

  await saveWalletStorage(masterPassword, storage);
  return storage;
}

/**
 * Set active wallet
 */
export async function setActiveWallet(masterPassword, walletName) {
  const storage = await loadWalletStorage(masterPassword);

  if (walletName && !storage.wallets[walletName]) {
    throw new Error(`Wallet '${walletName}' not found`);
  }

  storage.active_wallet = walletName;
  await saveWalletStorage(masterPassword, storage);
  return storage;
}

/**
 * Update wallet balance
 */
export async function updateWalletBalance(masterPassword, walletName, balance) {
  const storage = await loadWalletStorage(masterPassword);

  if (!storage.wallets[walletName]) {
    throw new Error(`Wallet '${walletName}' not found`);
  }

  storage.wallets[walletName].balance = balance;
  storage.wallets[walletName].last_updated = new Date().toISOString();

  await saveWalletStorage(masterPassword, storage);
  return storage;
}

/**
 * Add or update address book entry
 */
export async function addAddressBookEntry(masterPassword, entry) {
  const storage = await loadWalletStorage(masterPassword);

  // Remove existing entry with same label
  storage.address_book = storage.address_book.filter(e => e.label !== entry.label);

  // Add new entry
  storage.address_book.push({
    label: entry.label,
    address: entry.address,
    destination_tag: entry.destination_tag || null,
    created_at: new Date().toISOString()
  });

  await saveWalletStorage(masterPassword, storage);
  return storage;
}

/**
 * Remove address book entry
 */
export async function removeAddressBookEntry(masterPassword, label) {
  const storage = await loadWalletStorage(masterPassword);

  storage.address_book = storage.address_book.filter(e => e.label !== label);

  await saveWalletStorage(masterPassword, storage);
  return storage;
}

/**
 * Get wallet by name
 */
export async function getWallet(masterPassword, walletName) {
  const storage = await loadWalletStorage(masterPassword);
  return storage.wallets[walletName] || null;
}

/**
 * Get active wallet
 */
export async function getActiveWallet(masterPassword) {
  const storage = await loadWalletStorage(masterPassword);
  if (!storage.active_wallet) {
    return null;
  }
  return storage.wallets[storage.active_wallet] || null;
}

/**
 * List all wallets
 */
export async function listWallets(masterPassword) {
  const storage = await loadWalletStorage(masterPassword);
  return Object.values(storage.wallets);
}

/**
 * Get address book
 */
export async function getAddressBook(masterPassword) {
  const storage = await loadWalletStorage(masterPassword);
  return storage.address_book;
}

/**
 * Export wallet data (requires re-authentication)
 */
export async function exportWalletData(masterPassword) {
  const storage = await loadWalletStorage(masterPassword);

  // Return only essential data for export
  return {
    version: STORAGE_VERSION,
    wallets: storage.wallets,
    address_book: storage.address_book,
    exported_at: new Date().toISOString()
  };
}

/**
 * Import legacy Python wallet data
 */
export async function importLegacyData(masterPassword, legacyData) {
  const storage = await loadWalletStorage(masterPassword);

  // Handle legacy format conversion
  if (legacyData.wallets) {
    Object.entries(legacyData.wallets).forEach(([name, wallet]) => {
      storage.wallets[name] = {
        name: wallet.name || name,
        network: wallet.network || 'mainnet',
        address: wallet.address,
        secret: wallet.secret,
        secret_type: wallet.secret_type || 'seed',
        public_key: wallet.public_key,
        algorithm: wallet.algorithm || 'secp256k1',
        balance: wallet.balance || '0',
        imported_from: 'python_legacy',
        created_at: new Date().toISOString()
      };
    });
  }

  if (legacyData.address_book) {
    storage.address_book = legacyData.address_book.map(entry => ({
      label: entry.label,
      address: entry.address,
      destination_tag: entry.destination_tag || null,
      imported_from: 'python_legacy',
      created_at: new Date().toISOString()
    }));
  }

  if (legacyData.active_wallet && storage.wallets[legacyData.active_wallet]) {
    storage.active_wallet = legacyData.active_wallet;
  }

  await saveWalletStorage(masterPassword, storage);
  return storage;
}

/**
 * Verify master password without mutating state
 */
export async function verifyMasterPassword(password) {
  try {
    await loadWalletStorage(password);
    return true;
  } catch (error) {
    if (error.message === 'Invalid master password') {
      return false;
    }
    throw error;
  }
}

/**
 * Update wallet network selection
 */
export async function updateWalletNetwork(masterPassword, walletName, network) {
  const storage = await loadWalletStorage(masterPassword);
  if (!storage.wallets[walletName]) {
    throw new Error(`Wallet '${walletName}' not found`);
  }

  storage.wallets[walletName].network = network;
  storage.wallets[walletName].last_network_switch = new Date().toISOString();

  await saveWalletStorage(masterPassword, storage);
  return storage.wallets[walletName];
}

/**
 * Reset wallet storage (delete all data)
 */
export async function resetWalletStorage() {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }

  try {
    const result = await window.electronAPI.invoke('wallet-storage-reset');
    return result;
  } catch (error) {
    throw new Error(`Failed to reset wallet storage: ${error.message}`);
  }
}

/**
 * Export sensitive wallet secrets for a specific wallet
 */
export async function exportWalletSecrets(masterPassword, walletName) {
  const storage = await loadWalletStorage(masterPassword);
  const wallet = storage.wallets[walletName];

  if (!wallet) {
    throw new Error(`Wallet '${walletName}' not found`);
  }

  return {
    wallet_name: wallet.name,
    address: wallet.address,
    network: wallet.network,
    algorithm: wallet.algorithm,
    secret_type: wallet.secret_type,
    secret: wallet.secret,
    public_key: wallet.public_key,
    exported_at: new Date().toISOString()
  };
}
