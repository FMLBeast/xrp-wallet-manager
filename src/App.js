import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Button,
  Card,
  CardContent,
  IconButton,
  Chip,
  Alert,
  Snackbar,
  Tabs,
  Tab,
  CircularProgress,
  Backdrop
} from '@mui/material';
import {
  AccountBalanceWallet,
  Add,
  Refresh,
  Send,
  CallReceived,
  History,
  Settings,
  Security,
  NetworkCheck,
  Science,
  Download,
  Upload,
  People
} from '@mui/icons-material';

// Import our new components and utilities
import MasterPasswordDialog from './components/MasterPasswordDialog';
import ImportWalletDialog from './components/ImportWalletDialog';
import WalletTabs from './components/WalletTabs';
import { walletsFileExists, loadWalletStorage, addWallet, setActiveWallet, resetWalletStorage, addAddressBookEntry } from './utils/walletStorage';
import { generateTestWallet } from './utils/xrplWallet';
import { cacheKey, clearKey } from './utils/keyCache.js';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#2563eb',
    },
    secondary: {
      main: '#10b981',
    },
    background: {
      default: '#0f172a',
      paper: '#1e293b',
    },
  },
  typography: {
    fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
});

const drawerWidth = 320;

function App() {
  // Authentication state
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordDialogMode, setPasswordDialogMode] = useState('unlock');
  const [passwordDialogError, setPasswordDialogError] = useState('');
  const [passwordDialogLoading, setPasswordDialogLoading] = useState(false);

  // Wallet state
  const [wallets, setWallets] = useState({});
  const [activeWalletName, setActiveWalletName] = useState(null);
  const [addressBook, setAddressBook] = useState([]);

  // UI state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importDialogLoading, setImportDialogLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [loading, setLoading] = useState(false);

  // Loading states for specific operations
  const [loadingStates, setLoadingStates] = useState({
    balanceRefresh: {},          // { walletName: boolean }
    transactionHistory: {},      // { walletName: boolean }
    sendingTransaction: false,
    networkConnection: {},       // { walletName: boolean }
    accountInfo: {}              // { walletName: boolean }
  });

  // Network and balance state
  const [balances, setBalances] = useState({});
  const [networkStatus, setNetworkStatus] = useState({});

  // Initialize app on mount
  useEffect(() => {
    initializeApp();
    setupElectronMenuHandlers();

    return () => {
      cleanupElectronMenuHandlers();
      // Clear cached encryption key when app closes
      clearKey();
    };
  }, []);

  const initializeApp = async () => {
    try {
      const fileExists = await walletsFileExists();

      if (fileExists) {
        // Show unlock dialog
        setPasswordDialogMode('unlock');
        setShowPasswordDialog(true);
      } else {
        // Show create password dialog
        setPasswordDialogMode('create');
        setShowPasswordDialog(true);
      }
    } catch (error) {
      showSnackbar('Failed to initialize application: ' + error.message, 'error');
    }
  };

  const setupElectronMenuHandlers = () => {
    if (window.electronAPI) {
      window.electronAPI.onMenuNewWallet(() => {
        if (isUnlocked) {
          handleCreateNewWallet();
        }
      });

      window.electronAPI.onMenuImportWallet(() => {
        if (isUnlocked) {
          setShowImportDialog(true);
        }
      });

      window.electronAPI.onMenuSendTransaction(() => {
        if (isUnlocked && activeWalletName) {
          setSelectedTab(1); // Send tab
        }
      });

      window.electronAPI.onMenuReceive(() => {
        if (isUnlocked && activeWalletName) {
          setSelectedTab(2); // Receive tab
        }
      });

      window.electronAPI.onMenuRefreshBalance(() => {
        if (isUnlocked && activeWalletName) {
          handleRefreshBalance();
        }
      });
    }
  };

  const cleanupElectronMenuHandlers = () => {
    if (window.electronAPI) {
      window.electronAPI.removeAllListeners('menu-new-wallet');
      window.electronAPI.removeAllListeners('menu-import-wallet');
      window.electronAPI.removeAllListeners('menu-send-transaction');
      window.electronAPI.removeAllListeners('menu-receive');
      window.electronAPI.removeAllListeners('menu-refresh-balance');
    }
  };

  const handlePasswordSubmit = async (password) => {
    setPasswordDialogLoading(true);
    setPasswordDialogError('');

    try {
      if (passwordDialogMode === 'create') {
        // Create new encrypted storage
        const emptyStorage = {
          wallets: {},
          active_wallet: null,
          address_book: []
        };

        // Test that we can save and load
        const { saveWalletStorage } = require('./utils/walletStorage');
        await saveWalletStorage(password, emptyStorage);

        setMasterPassword(password);
        setWallets({});
        setActiveWalletName(null);
        setAddressBook([]);
        setIsUnlocked(true);
        setShowPasswordDialog(false);

        showSnackbar('Master password created successfully!', 'success');
      } else {
        // Unlock existing storage
        const storage = await loadWalletStorage(password);

        setMasterPassword(password);
        setWallets(storage.wallets || {});
        setActiveWalletName(storage.active_wallet);
        setAddressBook(storage.address_book || []);

        // Clean up any existing "Error" balance states and initialize balances
        const initialBalances = {};
        Object.keys(storage.wallets || {}).forEach(walletName => {
          const wallet = storage.wallets[walletName];
          initialBalances[walletName] = wallet.balance || '0';
        });
        setBalances(initialBalances);

        setIsUnlocked(true);
        setShowPasswordDialog(false);

        showSnackbar('Wallets unlocked successfully!', 'success');

        // Refresh balances for all wallets
        Object.keys(storage.wallets || {}).forEach(walletName => {
          refreshWalletBalance(walletName, storage.wallets[walletName], password);
        });
      }
    } catch (error) {
      setPasswordDialogError(error.message);
    } finally {
      setPasswordDialogLoading(false);
    }
  };

  const handlePasswordCancel = () => {
    setShowPasswordDialog(false);
    setPasswordDialogError('');

    // If not unlocked, show dialog again (can't use app without password)
    if (!isUnlocked) {
      setTimeout(() => {
        setShowPasswordDialog(true);
      }, 500);
    }
  };

  const handlePasswordReset = async () => {
    setPasswordDialogLoading(true);
    setPasswordDialogError('');

    try {
      await resetWalletStorage();

      // Clear cached encryption key
      clearKey();

      // Reset app state
      setWallets({});
      setActiveWalletName(null);
      setAddressBook([]);

      // Switch to create mode
      setPasswordDialogMode('create');
      setPasswordDialogError('');

      showSnackbar('All wallet data has been reset. Create a new master password.', 'info');
    } catch (error) {
      setPasswordDialogError('Failed to reset wallet data: ' + error.message);
    } finally {
      setPasswordDialogLoading(false);
    }
  };

  const handleCreateNewWallet = () => {
    // For now, show import dialog - we'll add generate option later
    setShowImportDialog(true);
  };

  const handleImportWallet = async (walletData) => {
    setImportDialogLoading(true);

    try {
      // Check if we have a valid master password
      if (!masterPassword) {
        throw new Error('Master password not available. Please unlock your wallet storage first.');
      }

      // Check if wallet name already exists
      if (wallets[walletData.name]) {
        throw new Error(`Wallet '${walletData.name}' already exists`);
      }

      // Add wallet to encrypted storage
      const storage = await addWallet(masterPassword, walletData);

      // Auto-add wallet address to address book for easy reference
      try {
        const addressBookEntry = {
          label: `${walletData.name} (${walletData.network})`,
          address: walletData.address,
          destination_tag: null
        };
        const updatedStorage = await addAddressBookEntry(masterPassword, addressBookEntry);

        // Update state with address book included
        setWallets(updatedStorage.wallets);
        setActiveWalletName(updatedStorage.active_wallet);
        setAddressBook(updatedStorage.address_book);
      } catch (addressBookError) {
        console.warn('Failed to add wallet to address book:', addressBookError);
        // Still update state with wallet, just without address book update
        setWallets(storage.wallets);
        setActiveWalletName(storage.active_wallet);
        setAddressBook(storage.address_book);
      }

      // Close dialog
      setShowImportDialog(false);
      setImportDialogLoading(false);

      showSnackbar(`Wallet '${walletData.name}' imported successfully!`, 'success');

      // Refresh balance for new wallet
      refreshWalletBalance(walletData.name, walletData, masterPassword);

    } catch (error) {
      setImportDialogLoading(false);
      showSnackbar('Failed to import wallet: ' + error.message, 'error');
    }
  };

  const handleWalletSelect = async (walletName) => {
    const startTime = Date.now();
    console.log(`[Performance] Starting wallet switch to '${walletName}'`);

    try {
      // Immediate UI feedback - update state optimistically
      setActiveWalletName(walletName);
      const uiUpdateTime = Date.now();
      console.log(`[Performance] UI updated in ${uiUpdateTime - startTime}ms`);

      const storage = await setActiveWallet(masterPassword, walletName);
      const encryptionTime = Date.now();
      console.log(`[Performance] Wallet switch completed in ${encryptionTime - startTime}ms (encryption: ${encryptionTime - uiUpdateTime}ms)`);

      // Confirm the state matches what was saved (defensive programming)
      setActiveWalletName(storage.active_wallet);
      showSnackbar(`Switched to wallet '${walletName}'`, 'info');
    } catch (error) {
      const errorTime = Date.now();
      console.log(`[Performance] Wallet switch failed after ${errorTime - startTime}ms`);

      // Revert optimistic update on error
      setActiveWalletName(activeWalletName);
      showSnackbar('Failed to switch wallet: ' + error.message, 'error');
    }
  };

  const refreshWalletBalance = async (walletName, walletData, masterPasswordOverride = null) => {
    setOperationLoading('balanceRefresh', walletName, true);
    setOperationLoading('networkConnection', walletName, true);

    try {
      const { createClient, getAccountInfo } = require('./utils/xrplWallet');
      const client = createClient(walletData.network);

      await client.connect();
      setOperationLoading('networkConnection', walletName, false);
      setOperationLoading('accountInfo', walletName, true);

      const accountInfo = await getAccountInfo(client, walletData.address);
      await client.disconnect();

      if (accountInfo.success) {
        const { formatAmount } = require('./utils/xrplWallet');
        const balance = formatAmount(accountInfo.balance);

        setBalances(prev => ({
          ...prev,
          [walletName]: balance
        }));

        // Update stored balance
        const { updateWalletBalance } = require('./utils/walletStorage');
        const passwordToUse = masterPasswordOverride || masterPassword;

        if (!passwordToUse) {
          console.warn(`No master password available for updating balance of ${walletName}`);
          return;
        }

        await updateWalletBalance(passwordToUse, walletName, balance);

        showSnackbar(`Balance updated for ${walletName}`, 'success');
      }
    } catch (error) {
      console.error(`Failed to refresh balance for ${walletName}:`, error);
      // Don't set balance to 'Error' - preserve the last known balance or fallback to wallet's stored balance
      const currentBalance = balances[walletName] || wallets[walletName]?.balance || '0';
      if (currentBalance === 'Error') {
        // If the current balance is 'Error', reset it to the stored balance or '0'
        setBalances(prev => ({
          ...prev,
          [walletName]: wallets[walletName]?.balance || '0'
        }));
      }
      showSnackbar(`Failed to refresh balance for ${walletName}: ${error.message}`, 'error');
    } finally {
      setOperationLoading('balanceRefresh', walletName, false);
      setOperationLoading('networkConnection', walletName, false);
      setOperationLoading('accountInfo', walletName, false);
    }
  };

  const handleRefreshBalance = () => {
    if (activeWalletName && wallets[activeWalletName]) {
      refreshWalletBalance(activeWalletName, wallets[activeWalletName]);
      showSnackbar('Refreshing balance...', 'info');
    }
  };

  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Helper functions for loading states
  const setOperationLoading = (operation, key, isLoading) => {
    setLoadingStates(prev => ({
      ...prev,
      [operation]: typeof key === 'string' ? {
        ...prev[operation],
        [key]: isLoading
      } : isLoading
    }));
  };

  const isOperationLoading = (operation, key = null) => {
    if (key === null) {
      return loadingStates[operation];
    }
    return loadingStates[operation]?.[key] || false;
  };

  // Memoize activeWallet to prevent unnecessary re-renders
  const activeWallet = useMemo(() => {
    return activeWalletName ? wallets[activeWalletName] : null;
  }, [activeWalletName, wallets]);

  // Memoize walletList to prevent unnecessary re-renders of the sidebar
  const walletList = useMemo(() => {
    return Object.values(wallets);
  }, [wallets]);

  const handleWalletUpdate = useCallback((walletName, updates) => {
    setWallets((prev) => {
      if (!prev[walletName]) {
        return prev;
      }
      return {
        ...prev,
        [walletName]: {
          ...prev[walletName],
          ...updates
        }
      };
    });
  }, []);

  const handleAddressBookChange = useCallback((entries = []) => {
    setAddressBook(entries);
  }, []);

  // Show password dialog if not unlocked
  if (!isUnlocked) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'background.default'
          }}
        >
          <Typography variant="h4" color="primary">
            XRP Wallet Manager
          </Typography>
        </Box>

        <MasterPasswordDialog
          open={showPasswordDialog}
          onSubmit={handlePasswordSubmit}
          onCancel={handlePasswordCancel}
          onReset={handlePasswordReset}
          mode={passwordDialogMode}
          loading={passwordDialogLoading}
          error={passwordDialogError}
        />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        {/* Sidebar */}
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              bgcolor: 'background.paper',
              borderRight: '1px solid rgba(255, 255, 255, 0.12)',
            },
          }}
        >
          <Toolbar>
            <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
              XRP Wallet Manager
            </Typography>
          </Toolbar>

          {/* Wallet Management Buttons */}
          <Box sx={{ p: 2 }}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<Add />}
              onClick={() => setShowImportDialog(true)}
              sx={{ mb: 1 }}
            >
              New Wallet
            </Button>
          </Box>

          {/* Wallet List */}
          <List sx={{ flexGrow: 1, px: 1 }}>
            {walletList.length === 0 ? (
              <ListItem>
                <Typography variant="body2" color="text.secondary">
                  No wallets yet. Create your first wallet above.
                </Typography>
              </ListItem>
            ) : (
              walletList.map((wallet) => (
                <ListItem key={wallet.name} disablePadding sx={{ mb: 1 }}>
                  <ListItemButton
                    selected={wallet.name === activeWalletName}
                    onClick={() => handleWalletSelect(wallet.name)}
                    sx={{
                      borderRadius: 1,
                      '&.Mui-selected': {
                        bgcolor: 'primary.main',
                        '&:hover': {
                          bgcolor: 'primary.dark',
                        },
                      },
                    }}
                  >
                    <ListItemIcon>
                      <AccountBalanceWallet />
                    </ListItemIcon>
                    <ListItemText
                      primary={wallet.name}
                      secondary={
                        <Box>
                          <Typography variant="caption" component="div">
                            {wallet.address?.slice(0, 8)}...
                          </Typography>
                          <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
                            <Chip
                              label={wallet.network}
                              size="small"
                              color={wallet.network === 'mainnet' ? 'primary' : 'secondary'}
                              variant="outlined"
                            />
                            <Typography variant="caption">
                              {balances[wallet.name] || wallet.balance || '0'} XRP
                            </Typography>
                          </Box>
                        </Box>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))
            )}
          </List>
        </Drawer>

        {/* Main Content */}
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Top App Bar */}
          <AppBar position="static" color="transparent" elevation={0}>
            <Toolbar>
              <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                {activeWallet ? activeWallet.name : 'No Wallet Selected'}
              </Typography>

              {activeWallet && (
                <Box display="flex" gap={1}>
                  <IconButton onClick={handleRefreshBalance} color="inherit">
                    <Refresh />
                  </IconButton>
                  <Chip
                    icon={isOperationLoading('networkConnection', activeWallet.name) ?
                      <CircularProgress size={16} /> :
                      (activeWallet.network === 'testnet' ? <Science /> : <NetworkCheck />)}
                    label={isOperationLoading('networkConnection', activeWallet.name) ?
                      'Connecting...' : activeWallet.network}
                    color={activeWallet.network === 'mainnet' ? 'primary' : 'secondary'}
                    variant="outlined"
                  />
                </Box>
              )}
            </Toolbar>
          </AppBar>

          {/* Main Content Area */}
          <Box sx={{ flexGrow: 1, p: 3 }}>
            {!activeWallet ? (
              // No wallet selected state
              <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                minHeight="400px"
                textAlign="center"
              >
                <AccountBalanceWallet sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h5" gutterBottom>
                  No Wallet Selected
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                  Create or select a wallet to get started
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<Add />}
                  onClick={() => setShowImportDialog(true)}
                >
                  Create Your First Wallet
                </Button>
              </Box>
            ) : (
              // Wallet tabs
              <Box>
                <Tabs
                  value={selectedTab}
                  onChange={(e, newValue) => setSelectedTab(newValue)}
                  sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
                >
                  <Tab icon={<AccountBalanceWallet />} label="Wallet" />
                  <Tab icon={<Send />} label="Send" />
                  <Tab icon={<CallReceived />} label="Receive" />
                  <Tab icon={<History />} label="History" />
                  <Tab icon={<Security />} label="Multi-Sig" />
                  <Tab icon={<People />} label="Address Book" />
                  <Tab icon={<Settings />} label="Settings" />
                </Tabs>

                <WalletTabs
                  selectedTab={selectedTab}
                  wallet={activeWallet}
                  balance={balances[activeWalletName] || activeWallet.balance || '0'}
                  onRefreshBalance={handleRefreshBalance}
                  onShowSnackbar={showSnackbar}
                  onTabChange={setSelectedTab}
                  addressBook={addressBook}
                  masterPassword={masterPassword}
                  onWalletUpdate={handleWalletUpdate}
                  onAddressBookChange={handleAddressBookChange}
                  loadingStates={loadingStates}
                  isOperationLoading={isOperationLoading}
                />
              </Box>
            )}
          </Box>
        </Box>

        {/* Dialogs */}
        <ImportWalletDialog
          open={showImportDialog}
          onClose={() => setShowImportDialog(false)}
          onImport={handleImportWallet}
          loading={importDialogLoading}
        />

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleSnackbarClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <Alert
            onClose={handleSnackbarClose}
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>

        {/* Loading backdrop */}
        <Backdrop
          sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
          open={loading}
        >
          <CircularProgress color="inherit" />
        </Backdrop>
      </Box>
    </ThemeProvider>
  );
}

export default App;
