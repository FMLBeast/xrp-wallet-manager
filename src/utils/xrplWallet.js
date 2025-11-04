/**
 * XRPL wallet utilities with algorithm detection and key derivation
 * Replicates Python version's SecretInfo class and wallet operations
 */

import { Client, Wallet, xrpToDrops, dropsToXrp } from 'xrpl';

// Network configurations
const NETWORKS = {
  mainnet: 'wss://xrplcluster.com',
  testnet: 'wss://s.altnet.rippletest.net:51233',
  devnet: 'wss://s.devnet.rippletest.net:51233'
};

/**
 * Detect algorithm from secret format
 */
export function detectAlgorithm(secret) {
  // ED25519 seed: ED followed by 64 hex characters
  if (secret.match(/^ED[0-9A-Fa-f]{64}$/)) {
    return 'ed25519';
  }

  // secp256k1 private key: 64 hex characters
  if (secret.match(/^[0-9A-Fa-f]{64}$/)) {
    return 'secp256k1';
  }

  // Family seed: starts with 's' and encoded in base58
  if (secret.match(/^s[a-km-zA-HJ-NP-Z1-9]{25,50}$/)) {
    return 'secp256k1'; // Default for family seeds
  }

  // Mnemonic phrase: 12 or 24 words
  const words = secret.trim().split(/\s+/);
  if (words.length === 12 || words.length === 24) {
    return 'secp256k1'; // Default for mnemonic
  }

  throw new Error('Unrecognized secret format');
}

/**
 * Detect secret type from format
 */
export function detectSecretType(secret) {
  // ED25519 seed
  if (secret.match(/^ED[0-9A-Fa-f]{64}$/)) {
    return 'seed';
  }

  // secp256k1 private key
  if (secret.match(/^[0-9A-Fa-f]{64}$/)) {
    return 'private_key';
  }

  // Family seed
  if (secret.match(/^s[a-km-zA-HJ-NP-Z1-9]{25,50}$/)) {
    return 'seed';
  }

  // Mnemonic phrase
  const words = secret.trim().split(/\s+/);
  if (words.length === 12 || words.length === 24) {
    return 'mnemonic';
  }

  throw new Error('Unrecognized secret format');
}

/**
 * Create wallet from secret with algorithm detection
 * Replicates Python SecretInfo class functionality
 */
export function createWalletFromSecret(secret) {
  try {
    const cleanSecret = secret.trim();

    // Detect algorithm and secret type
    const algorithm = detectAlgorithm(cleanSecret);
    const secretType = detectSecretType(cleanSecret);

    // Create wallet instance
    let wallet;
    if (secretType === 'mnemonic') {
      // Handle mnemonic phrases
      wallet = Wallet.fromMnemonic(cleanSecret);
    } else {
      // Handle seeds and private keys
      wallet = Wallet.fromSeed(cleanSecret);
    }

    // Generate suggested name based on address
    const addressSuffix = wallet.address.slice(-6);
    const suggested_name = `Wallet-${addressSuffix}`;

    return {
      address: wallet.address,
      public_key: wallet.publicKey,
      secret_type: secretType,
      algorithm: algorithm,
      suggested_name: suggested_name,
      wallet: wallet // Include wallet instance for transactions
    };
  } catch (error) {
    throw new Error(`Invalid wallet secret: ${error.message}`);
  }
}

/**
 * Generate a new test wallet with funding from faucet
 */
export async function generateTestWallet() {
  try {
    const client = createClient('testnet');
    await client.connect();

    // Generate new wallet
    const { wallet } = await client.fundWallet();

    await client.disconnect();

    const addressSuffix = wallet.address.slice(-6);
    const suggested_name = `TestWallet-${addressSuffix}`;

    return {
      address: wallet.address,
      public_key: wallet.publicKey,
      secret: wallet.seed,
      secret_type: 'seed',
      algorithm: 'secp256k1',
      suggested_name: suggested_name,
      wallet: wallet,
      balance: '1000' // Default testnet funding
    };
  } catch (error) {
    throw new Error(`Failed to generate test wallet: ${error.message}`);
  }
}

/**
 * Create XRPL client for specified network
 */
export function createClient(network = 'testnet') {
  const server = NETWORKS[network];
  if (!server) {
    throw new Error(`Unknown network: ${network}`);
  }

  return new Client(server);
}

/**
 * Get account information including balance
 */
export async function getAccountInfo(client, address) {
  try {
    const accountInfo = await client.request({
      command: 'account_info',
      account: address,
      ledger_index: 'validated'
    });

    return {
      success: true,
      balance: accountInfo.result.account_data.Balance,
      sequence: accountInfo.result.account_data.Sequence,
      flags: accountInfo.result.account_data.Flags,
      owner_count: accountInfo.result.account_data.OwnerCount
    };
  } catch (error) {
    if (error.data?.error === 'actNotFound') {
      return {
        success: true,
        balance: '0',
        sequence: 0,
        flags: 0,
        owner_count: 0,
        unfunded: true
      };
    }
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get account transaction history
 */
export async function getAccountTransactions(client, address, limit = 20) {
  try {
    const response = await client.request({
      command: 'account_tx',
      account: address,
      ledger_index_min: -1,
      ledger_index_max: -1,
      limit: limit
    });

    const transactions = response.result.transactions.map(tx => ({
      hash: tx.tx.hash,
      type: tx.tx.TransactionType,
      date: tx.tx.date ? new Date((tx.tx.date + 946684800) * 1000) : null,
      fee: tx.tx.Fee,
      sequence: tx.tx.Sequence,
      account: tx.tx.Account,
      destination: tx.tx.Destination,
      amount: tx.tx.Amount,
      destination_tag: tx.tx.DestinationTag,
      validated: tx.validated,
      ledger_index: tx.ledger_index,
      meta: tx.meta
    }));

    return {
      success: true,
      transactions
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Prepare a payment transaction
 */
export async function preparePayment(client, fromWallet, toAddress, amount, destinationTag = null) {
  try {
    const payment = {
      TransactionType: 'Payment',
      Account: fromWallet.address,
      Destination: toAddress,
      Amount: xrpToDrops(amount.toString())
    };

    if (destinationTag !== null && destinationTag !== undefined) {
      payment.DestinationTag = parseInt(destinationTag);
    }

    const prepared = await client.autofill(payment);

    return {
      success: true,
      transaction: prepared,
      fee: dropsToXrp(prepared.Fee),
      total: (parseFloat(amount) + parseFloat(dropsToXrp(prepared.Fee))).toString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Sign and submit a transaction
 */
export async function signAndSubmit(client, wallet, transaction) {
  try {
    const signed = wallet.sign(transaction);
    const result = await client.submitAndWait(signed.tx_blob);

    return {
      success: true,
      hash: result.result.hash,
      validated: result.result.validated,
      meta: result.result.meta,
      ledger_index: result.result.ledger_index
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Format amount for display (drops to XRP)
 */
export function formatAmount(drops) {
  if (typeof drops === 'string' && drops !== '0') {
    return dropsToXrp(drops);
  }
  return drops;
}

/**
 * Validate XRP address
 */
export function isValidAddress(address) {
  try {
    // Basic format check for XRPL addresses
    return /^r[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address);
  } catch (error) {
    return false;
  }
}

/**
 * Validate destination tag
 */
export function isValidDestinationTag(tag) {
  if (tag === null || tag === undefined || tag === '') {
    return true; // Optional
  }

  // Must be a whole number, not a decimal
  if (typeof tag === 'string' && tag.includes('.')) {
    return false;
  }

  const num = parseInt(tag);
  return !isNaN(num) && num >= 0 && num <= 4294967295 && num.toString() === tag.toString(); // 32-bit unsigned integer
}

/**
 * Validate XRP amount
 */
export function validateAmount(amount) {
  if (!amount || amount === '0') {
    return { isValid: false, error: 'Amount is required' };
  }

  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) {
    return { isValid: false, error: 'Amount must be a positive number' };
  }

  if (num < 0.000001) {
    return { isValid: false, error: 'Amount is too small (minimum 0.000001 XRP)' };
  }

  if (num > 100000000000) {
    return { isValid: false, error: 'Amount is too large' };
  }

  return { isValid: true };
}

/**
 * Get network configuration
 */
export function getNetworkConfig(network) {
  const configs = {
    mainnet: {
      name: 'Mainnet',
      server: 'wss://xrplcluster.com',
      explorer: 'https://livenet.xrpl.org',
      color: 'primary'
    },
    testnet: {
      name: 'Testnet',
      server: 'wss://s.altnet.rippletest.net:51233',
      explorer: 'https://testnet.xrpl.org',
      color: 'secondary'
    },
    devnet: {
      name: 'Devnet',
      server: 'wss://s.devnet.rippletest.net:51233',
      explorer: 'https://devnet.xrpl.org',
      color: 'warning'
    }
  };

  return configs[network] || configs.testnet;
}

/**
 * Get network explorer URL for transaction
 */
export function getExplorerUrl(network, hash) {
  const explorers = {
    mainnet: 'https://livenet.xrpl.org',
    testnet: 'https://testnet.xrpl.org',
    devnet: 'https://devnet.xrpl.org'
  };

  const baseUrl = explorers[network] || explorers.testnet;
  return `${baseUrl}/transactions/${hash}`;
}

/**
 * Get network explorer URL for account
 */
export function getAccountExplorerUrl(network, address) {
  const explorers = {
    mainnet: 'https://livenet.xrpl.org',
    testnet: 'https://testnet.xrpl.org',
    devnet: 'https://devnet.xrpl.org'
  };

  const baseUrl = explorers[network] || explorers.testnet;
  return `${baseUrl}/accounts/${address}`;
}