const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Wallet storage operations
  invoke: (channel, ...args) => {
    const validChannels = [
      'wallet-storage-exists',
      'wallet-storage-load',
      'wallet-storage-save',
      'wallet-storage-backup',
      'wallet-storage-restore'
    ];

    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    throw new Error(`Invalid IPC channel: ${channel}`);
  },

  // Menu event listeners
  onMenuNewWallet: (callback) => {
    ipcRenderer.on('menu-new-wallet', callback);
  },

  onMenuImportWallet: (callback) => {
    ipcRenderer.on('menu-import-wallet', callback);
  },

  onMenuSendTransaction: (callback) => {
    ipcRenderer.on('menu-send-transaction', callback);
  },

  onMenuReceive: (callback) => {
    ipcRenderer.on('menu-receive', callback);
  },

  onMenuRefreshBalance: (callback) => {
    ipcRenderer.on('menu-refresh-balance', callback);
  },

  onMenuExportWallet: (callback) => {
    ipcRenderer.on('menu-export-wallet', callback);
  },

  // Remove listeners
  removeAllListeners: (channel) => {
    const validChannels = [
      'menu-new-wallet',
      'menu-import-wallet',
      'menu-send-transaction',
      'menu-receive',
      'menu-refresh-balance',
      'menu-export-wallet'
    ];

    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },

  // Platform detection
  platform: process.platform,

  // Version info
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
});