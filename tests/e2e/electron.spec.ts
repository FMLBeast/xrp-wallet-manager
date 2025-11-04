import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const binaries: Record<NodeJS.Platform, string> = {
  darwin: path.resolve(__dirname, '../../dist-electron/mac/XRP Wallet Manager.app/Contents/MacOS/XRP Wallet Manager'),
  linux: path.resolve(__dirname, '../../dist-electron/linux-unpacked/xrp-wallet-manager'),
  win32: path.resolve(__dirname, '../../dist-electron/win-unpacked/XRP Wallet Manager.exe'),
};

const binaryPath = binaries[process.platform];

test.describe('Electron XRP Wallet Manager', () => {
  test.skip(!binaryPath || !fs.existsSync(binaryPath), 'Electron bundle not found. Run `npm run dist` first.');

  test('launches the application window', async () => {
    const app = await electron.launch({ executablePath: binaryPath });
    const window = await app.firstWindow();

    await window.waitForLoadState('domcontentloaded');
    await expect(window).toHaveTitle(/XRP Wallet Manager/i);

    await app.close();
  });
});
