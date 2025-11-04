import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';

const binaries: Record<NodeJS.Platform, string> = {
  darwin: path.resolve(__dirname, '../../dist-electron/mac/XRP Wallet Manager.app/Contents/MacOS/XRP Wallet Manager'),
  linux: path.resolve(__dirname, '../../dist-electron/linux-unpacked/xrp-wallet-manager'),
  win32: path.resolve(__dirname, '../../dist-electron/win-unpacked/XRP Wallet Manager.exe'),
};

const binaryPath = binaries[process.platform];

// Test data
const TEST_PASSWORD = 'test-password-123';
const TEST_WALLET_SEED = 'sEdVkiMHgv2hpvMCGM45jjKCjK5qrJvLR4EQGWhJ6hYvjcY6BtfGN';
const TEST_WALLET_NAME = 'Test Wallet E2E';

test.describe('Electron XRP Wallet Manager', () => {
  test.skip(!binaryPath || !fs.existsSync(binaryPath), 'Electron bundle not found. Run `npm run dist` first.');

  // Helper function to clean up wallet files before tests
  test.beforeEach(async () => {
    const walletPath = path.join(os.homedir(), 'Library', 'Application Support', 'xrp-wallet-manager', 'wallets.enc');
    if (fs.existsSync(walletPath)) {
      fs.unlinkSync(walletPath);
    }
  });

  test('launches the application window', async () => {
    const app = await electron.launch({ executablePath: binaryPath });
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await expect(window).toHaveTitle(/XRP Wallet Manager/i);
    await app.close();
  });

  test('creates master password on first launch', async () => {
    const app = await electron.launch({ executablePath: binaryPath });
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Should show master password creation dialog
    await expect(window.locator('text=Create Master Password')).toBeVisible();

    // Fill in password
    await window.fill('input[type="password"]', TEST_PASSWORD);

    // Submit
    await window.click('button:has-text("Create Password")');

    // Should show main interface
    await expect(window.locator('text=XRP Wallet Manager')).toBeVisible();
    await expect(window.locator('text=No wallets yet')).toBeVisible();

    await app.close();
  });

  test('unlocks with master password on subsequent launches', async () => {
    // First, create the password
    let app = await electron.launch({ executablePath: binaryPath });
    let window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    await window.fill('input[type="password"]', TEST_PASSWORD);
    await window.click('button:has-text("Create Password")');
    await window.waitForSelector('text=No wallets yet');
    await app.close();

    // Now test unlocking
    app = await electron.launch({ executablePath: binaryPath });
    window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Should show unlock dialog
    await expect(window.locator('text=Enter Master Password')).toBeVisible();

    // Enter correct password
    await window.fill('input[type="password"]', TEST_PASSWORD);
    await window.click('button:has-text("Unlock")');

    // Should show main interface
    await expect(window.locator('text=No wallets yet')).toBeVisible();

    await app.close();
  });

  test('imports a wallet successfully', async () => {
    const app = await electron.launch({ executablePath: binaryPath });
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Create master password
    await window.fill('input[type="password"]', TEST_PASSWORD);
    await window.click('button:has-text("Create Password")');
    await window.waitForSelector('text=No wallets yet');

    // Click New Wallet button
    await window.click('button:has-text("New Wallet")');

    // Should show import dialog
    await expect(window.locator('text=Import Wallet')).toBeVisible();

    // Enter wallet secret
    await window.fill('textarea[placeholder*="Enter seed phrase"]', TEST_WALLET_SEED);

    // Wait for wallet validation
    await expect(window.locator('text=Valid Wallet Detected')).toBeVisible();

    // Click Next
    await window.click('button:has-text("Next")');

    // Configure wallet
    await window.fill('input[label="Wallet Name"]', TEST_WALLET_NAME);

    // Set to testnet (should be default)
    await expect(window.locator('text=Testnet')).toBeVisible();

    // Click Next
    await window.click('button:has-text("Next")');

    // Review and import
    await expect(window.locator(`text=${TEST_WALLET_NAME}`)).toBeVisible();
    await window.click('button:has-text("Import Wallet")');

    // Should show success and wallet in sidebar
    await expect(window.locator(`text=${TEST_WALLET_NAME}`)).toBeVisible();
    await expect(window.locator('text=Wallet imported successfully')).toBeVisible();

    await app.close();
  });

  test('generates test wallet with faucet funding', async () => {
    const app = await electron.launch({ executablePath: binaryPath });
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Create master password
    await window.fill('input[type="password"]', TEST_PASSWORD);
    await window.click('button:has-text("Create Password")');
    await window.waitForSelector('text=No wallets yet');

    // Click New Wallet button
    await window.click('button:has-text("New Wallet")');

    // Click Generate Test Wallet
    await window.click('button:has-text("Generate Test Wallet")');

    // Should auto-fill the form with generated wallet
    await expect(window.locator('text=Valid Wallet Detected')).toBeVisible();
    await expect(window.locator('input[label="Wallet Name"]')).toHaveValue(/TestWallet-/);

    // Continue through the flow
    await window.click('button:has-text("Next")');
    await window.click('button:has-text("Next")');
    await window.click('button:has-text("Import Wallet")');

    // Should show success
    await expect(window.locator('text=Wallet imported successfully')).toBeVisible();

    await app.close();
  });

  test('navigates between wallet tabs', async () => {
    const app = await electron.launch({ executablePath: binaryPath });
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Setup: create password and import wallet
    await window.fill('input[type="password"]', TEST_PASSWORD);
    await window.click('button:has-text("Create Password")');
    await window.waitForSelector('text=No wallets yet');

    await window.click('button:has-text("New Wallet")');
    await window.fill('textarea[placeholder*="Enter seed phrase"]', TEST_WALLET_SEED);
    await window.waitForSelector('text=Valid Wallet Detected');
    await window.click('button:has-text("Next")');
    await window.fill('input[label="Wallet Name"]', TEST_WALLET_NAME);
    await window.click('button:has-text("Next")');
    await window.click('button:has-text("Import Wallet")');
    await window.waitForSelector('text=Wallet imported successfully');

    // Test tab navigation
    await expect(window.locator('text=Wallet')).toBeVisible(); // Should be on Wallet tab

    // Click Send tab
    await window.click('[role="tab"]:has-text("Send")');
    await expect(window.locator('text=Send XRP')).toBeVisible();

    // Click Receive tab
    await window.click('[role="tab"]:has-text("Receive")');
    await expect(window.locator('text=Receive XRP')).toBeVisible();

    // Click History tab
    await window.click('[role="tab"]:has-text("History")');
    await expect(window.locator('text=Transaction History')).toBeVisible();

    // Click Multi-Sig tab
    await window.click('[role="tab"]:has-text("Multi-Sig")');
    await expect(window.locator('text=Multi-Signature Wallets')).toBeVisible();

    // Click Address Book tab
    await window.click('[role="tab"]:has-text("Address Book")');
    await expect(window.locator('text=Address Book')).toBeVisible();

    // Click Settings tab
    await window.click('[role="tab"]:has-text("Settings")');
    await expect(window.locator('text=Wallet Settings')).toBeVisible();

    await app.close();
  });

  test('displays wallet balance and information', async () => {
    const app = await electron.launch({ executablePath: binaryPath });
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Setup: create password and import wallet
    await window.fill('input[type="password"]', TEST_PASSWORD);
    await window.click('button:has-text("Create Password")');
    await window.waitForSelector('text=No wallets yet');

    await window.click('button:has-text("New Wallet")');
    await window.fill('textarea[placeholder*="Enter seed phrase"]', TEST_WALLET_SEED);
    await window.waitForSelector('text=Valid Wallet Detected');
    await window.click('button:has-text("Next")');
    await window.fill('input[label="Wallet Name"]', TEST_WALLET_NAME);
    await window.click('button:has-text("Next")');
    await window.click('button:has-text("Import Wallet")');
    await window.waitForSelector('text=Wallet imported successfully');

    // Check wallet information is displayed
    await expect(window.locator(`text=${TEST_WALLET_NAME}`)).toBeVisible();
    await expect(window.locator('text=testnet')).toBeVisible(); // Network chip
    await expect(window.locator('text=XRP')).toBeVisible(); // Balance display

    // Check wallet details in main area
    await expect(window.locator('text=Account Address')).toBeVisible();
    await expect(window.locator('text=r').nth(0)).toBeVisible(); // XRP address starts with 'r'

    await app.close();
  });

  test('validates send transaction form', async () => {
    const app = await electron.launch({ executablePath: binaryPath });
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Setup: create password and import wallet
    await window.fill('input[type="password"]', TEST_PASSWORD);
    await window.click('button:has-text("Create Password")');
    await window.waitForSelector('text=No wallets yet');

    await window.click('button:has-text("New Wallet")');
    await window.fill('textarea[placeholder*="Enter seed phrase"]', TEST_WALLET_SEED);
    await window.waitForSelector('text=Valid Wallet Detected');
    await window.click('button:has-text("Next")');
    await window.fill('input[label="Wallet Name"]', TEST_WALLET_NAME);
    await window.click('button:has-text("Next")');
    await window.click('button:has-text("Import Wallet")');
    await window.waitForSelector('text=Wallet imported successfully');

    // Navigate to Send tab
    await window.click('[role="tab"]:has-text("Send")');

    // Try to send without filling form
    await window.click('button:has-text("Send XRP")');

    // Should show validation errors
    await expect(window.locator('text=Destination address is required')).toBeVisible();
    await expect(window.locator('text=Amount is required')).toBeVisible();

    // Fill invalid address
    await window.fill('input[label="Destination Address"]', 'invalid-address');
    await window.click('button:has-text("Send XRP")');
    await expect(window.locator('text=Invalid destination address')).toBeVisible();

    // Fill valid address but invalid amount
    await window.fill('input[label="Destination Address"]', 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH');
    await window.fill('input[label="Amount (XRP)"]', '0');
    await window.click('button:has-text("Send XRP")');
    await expect(window.locator('text=Amount must be greater than 0')).toBeVisible();

    await app.close();
  });

  test('shows QR code for receiving payments', async () => {
    const app = await electron.launch({ executablePath: binaryPath });
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Setup: create password and import wallet
    await window.fill('input[type="password"]', TEST_PASSWORD);
    await window.click('button:has-text("Create Password")');
    await window.waitForSelector('text=No wallets yet');

    await window.click('button:has-text("New Wallet")');
    await window.fill('textarea[placeholder*="Enter seed phrase"]', TEST_WALLET_SEED);
    await window.waitForSelector('text=Valid Wallet Detected');
    await window.click('button:has-text("Next")');
    await window.fill('input[label="Wallet Name"]', TEST_WALLET_NAME);
    await window.click('button:has-text("Next")');
    await window.click('button:has-text("Import Wallet")');
    await window.waitForSelector('text=Wallet imported successfully');

    // Navigate to Receive tab
    await window.click('[role="tab"]:has-text("Receive")');

    // Should show QR code
    await expect(window.locator('canvas')).toBeVisible(); // QR code canvas
    await expect(window.locator('text=Scan QR Code')).toBeVisible();

    // Should show address
    await expect(window.locator('text=r').nth(0)).toBeVisible();

    // Test copy address functionality
    await window.click('button[aria-label="Copy address"]');
    // Note: We can't easily test clipboard in E2E, but button should be clickable

    await app.close();
  });

  test('handles network switching', async () => {
    const app = await electron.launch({ executablePath: binaryPath });
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Setup: create password and import wallet
    await window.fill('input[type="password"]', TEST_PASSWORD);
    await window.click('button:has-text("Create Password")');
    await window.waitForSelector('text=No wallets yet');

    await window.click('button:has-text("New Wallet")');
    await window.fill('textarea[placeholder*="Enter seed phrase"]', TEST_WALLET_SEED);
    await window.waitForSelector('text=Valid Wallet Detected');
    await window.click('button:has-text("Next")');
    await window.fill('input[label="Wallet Name"]', TEST_WALLET_NAME);
    await window.click('button:has-text("Next")');
    await window.click('button:has-text("Import Wallet")');
    await window.waitForSelector('text=Wallet imported successfully');

    // Navigate to Settings tab
    await window.click('[role="tab"]:has-text("Settings")');

    // Should show current network (testnet)
    await expect(window.locator('text=testnet')).toBeVisible();

    // Test network switching UI exists
    await expect(window.locator('text=Network')).toBeVisible();

    await app.close();
  });

  test('handles application menu interactions', async () => {
    const app = await electron.launch({ executablePath: binaryPath });
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Create master password first
    await window.fill('input[type="password"]', TEST_PASSWORD);
    await window.click('button:has-text("Create Password")');
    await window.waitForSelector('text=No wallets yet');

    // Test basic menu functionality (platform-dependent)
    if (process.platform === 'darwin') {
      // On macOS, test native menu bar
      await window.keyboard.press('Meta+N'); // Cmd+N for new wallet
      await expect(window.locator('text=Import Wallet')).toBeVisible();
      await window.keyboard.press('Escape'); // Close dialog
    }

    await app.close();
  });
});
