const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const isDev = require('electron-is-dev');

// Keep a global reference of the window object
let mainWindow;

// Wallet storage file path
const WALLETS_FILE = path.join(app.getPath('userData'), 'wallets.enc');

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true
    },
    titleBarStyle: 'default', // Use default titlebar to ensure dragging works
    show: false,
    frame: true, // Ensure window frame is visible for dragging
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  // Load the app
  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, 'build/index.html')}`;

  mainWindow.loadURL(startUrl);

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // DevTools can be opened manually via View menu or F12
    // Auto-opening disabled for cleaner startup experience
  });

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Set up application menu
  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Wallet',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-new-wallet');
            }
          }
        },
        {
          label: 'Import Wallet',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-import-wallet');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Export Wallet Data',
          click: async () => {
            const result = await dialog.showSaveDialog(mainWindow, {
              title: 'Export Wallet Data',
              defaultPath: 'wallet-backup.json',
              filters: [
                { name: 'JSON Files', extensions: ['json'] }
              ]
            });

            if (!result.canceled && result.filePath) {
              mainWindow.webContents.send('menu-export-wallet', result.filePath);
            }
          }
        },
        { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Wallet',
      submenu: [
        {
          label: 'Send Transaction',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-send-transaction');
            }
          }
        },
        {
          label: 'Receive',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-receive');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Refresh Balance',
          accelerator: 'CmdOrCtrl+F5',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-refresh-balance');
            }
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteandmatchstyle' },
        { role: 'delete' },
        { role: 'selectall' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'About XRP Wallet Manager',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About XRP Wallet Manager',
              message: 'XRP Wallet Manager',
              detail: 'Secure XRP Ledger wallet manager with multi-wallet support\nVersion 1.0.0',
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  // macOS specific menu adjustments
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });

    // Window menu (adjusted index due to added Edit menu)
    template[5].submenu = [
      { role: 'close' },
      { role: 'minimize' },
      { role: 'zoom' },
      { type: 'separator' },
      { role: 'front' }
    ];
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers for wallet storage operations
ipcMain.handle('wallet-storage-exists', async () => {
  try {
    await fs.access(WALLETS_FILE);
    return true;
  } catch (error) {
    return false;
  }
});

ipcMain.handle('wallet-storage-load', async () => {
  try {
    const data = await fs.readFile(WALLETS_FILE, 'utf8');
    return data;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null; // File doesn't exist
    }
    throw error;
  }
});

ipcMain.handle('wallet-storage-save', async (event, encryptedData) => {
  try {
    // Ensure the directory exists
    const dir = path.dirname(WALLETS_FILE);
    await fs.mkdir(dir, { recursive: true });

    // Write the encrypted data
    await fs.writeFile(WALLETS_FILE, encryptedData, 'utf8');
    return { success: true };
  } catch (error) {
    console.error('Failed to save wallet storage:', error);
    throw error;
  }
});

ipcMain.handle('wallet-storage-backup', async (event, backupPath) => {
  try {
    const data = await fs.readFile(WALLETS_FILE, 'utf8');
    await fs.writeFile(backupPath, data, 'utf8');
    return { success: true };
  } catch (error) {
    console.error('Failed to backup wallet storage:', error);
    throw error;
  }
});

ipcMain.handle('wallet-storage-restore', async (event, backupPath) => {
  try {
    const data = await fs.readFile(backupPath, 'utf8');

    // Validate that it's encrypted wallet data
    try {
      const parsed = JSON.parse(data);
      if (!parsed.version || !parsed.salt || !parsed.nonce || !parsed.ciphertext || !parsed.mac) {
        throw new Error('Invalid wallet backup file format');
      }
    } catch (parseError) {
      throw new Error('Invalid wallet backup file');
    }

    // Create backup of existing file if it exists
    try {
      await fs.access(WALLETS_FILE);
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const backupFileName = `wallets.enc.backup.${timestamp}`;
      const backupFilePath = path.join(path.dirname(WALLETS_FILE), backupFileName);
      await fs.copyFile(WALLETS_FILE, backupFilePath);
    } catch (error) {
      // File doesn't exist, no need to backup
    }

    // Restore the backup
    await fs.writeFile(WALLETS_FILE, data, 'utf8');
    return { success: true };
  } catch (error) {
    console.error('Failed to restore wallet storage:', error);
    throw error;
  }
});

// Reset wallet storage (delete the file)
ipcMain.handle('wallet-storage-reset', async () => {
  try {
    // Create backup before deletion
    try {
      await fs.access(WALLETS_FILE);
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const backupFileName = `wallets.enc.reset-backup.${timestamp}`;
      const backupFilePath = path.join(path.dirname(WALLETS_FILE), backupFileName);
      await fs.copyFile(WALLETS_FILE, backupFilePath);
      console.log('Created backup before reset:', backupFilePath);
    } catch (error) {
      // File doesn't exist, no need to backup
    }

    // Delete the wallet file
    try {
      await fs.unlink(WALLETS_FILE);
      console.log('Wallet storage file deleted successfully');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // File already doesn't exist
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to reset wallet storage:', error);
    throw error;
  }
});

// Handle app events
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // On macOS it is common for applications to stay open until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS re-create window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
  });
});

// Handle protocol for deep linking (optional future feature)
app.setAsDefaultProtocolClient('xrp-wallet-manager');

// Handle deep link on macOS
app.on('open-url', (event, url) => {
  event.preventDefault();
  // Handle deep link URL if needed
});

// Handle deep link on Windows
app.on('second-instance', (event, commandLine, workingDirectory) => {
  // Handle deep link from command line if needed
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}