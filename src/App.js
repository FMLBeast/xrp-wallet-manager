import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  IconButton,
  Chip,
  TextField,
  Alert,
  Snackbar,
  Tabs,
  Tab,
  CircularProgress
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
  Science,
  People,
  Edit,
  Check,
  Close,
  Lock,
  LockOpen
} from '@mui/icons-material';
import MasterPasswordDialog from './components/MasterPasswordDialog';
import ImportWalletDialog from './components/ImportWalletDialog';
import WalletTabs from './components/WalletTabs';
import { walletsFileExists, loadWalletStorage, addWallet, resetWalletStorage, addAddressBookEntry, renameWallet, updateWalletOrder, updateWalletBalance, saveWalletStorage } from './utils/walletStorage';
import { calculateReserves, createClient, getAccountInfo, formatAmount } from './utils/xrplWallet';
import { clearKey } from './utils/keyCache.js';

// Optimized Sortable Wallet Item Component
const SortableWalletItem = React.memo(function SortableWalletItem({ wallet, children, isDragDisabled = false }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: wallet.name, disabled: isDragDisabled });

  // Memoize style object to prevent recreation during drag
  const style = useMemo(() => ({
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  }), [transform, transition, isDragging]);

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
});

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

  // Wallet management state
  const [customWalletOrder, setCustomWalletOrder] = useState([]); // Array of wallet names in custom order
  const [renamingWallet, setRenamingWallet] = useState(null);
  const [editMode, setEditMode] = useState(false); // Controls visibility of edit icons

  // Debouncing ref for wallet selection to prevent rapid click cascading
  const walletSelectTimeoutRef = useRef(null);

  // Optimized drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement to start drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Helper functions for loading states
  const setOperationLoading = useCallback((operation, key, isLoading) => {
    setLoadingStates(prev => ({
      ...prev,
      [operation]: typeof key === 'string' ? {
        ...prev[operation],
        [key]: isLoading
      } : isLoading
    }));
  }, []);

  const showSnackbar = useCallback((message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const initializeApp = useCallback(async () => {
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
  }, [showSnackbar]);

  const refreshWalletBalance = useCallback(async (walletName, walletData, masterPasswordOverride = null) => {
    setOperationLoading('balanceRefresh', walletName, true);
    setOperationLoading('networkConnection', walletName, true);

    const client = createClient(walletData.network);

    try {
      // Add timeout to prevent hanging on slow/offline network endpoints
      console.log(`[Performance] Starting balance refresh for ${walletName} with 8-second timeout`);

      // Connect with 5-second timeout
      await Promise.race([
        client.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout after 5 seconds')), 5000)
        )
      ]);

      setOperationLoading('networkConnection', walletName, false);
      setOperationLoading('accountInfo', walletName, true);

      // Account info request with 3-second timeout
      const accountInfo = await Promise.race([
        getAccountInfo(client, walletData.address),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Account info timeout after 3 seconds')), 3000)
        )
      ]);

      // Disconnect with timeout (less critical but prevents edge case hangs)
      await Promise.race([
        client.disconnect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Disconnect timeout after 2 seconds')), 2000)
        )
      ]);

      if (accountInfo.success) {
        const balance = formatAmount(accountInfo.balance);

        setBalances(prev => ({
          ...prev,
          [walletName]: balance
        }));

        // Update stored balance
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
  }, [masterPassword, setOperationLoading, showSnackbar]);

  const handleRefreshBalance = useCallback(() => {
    if (activeWalletName && wallets[activeWalletName]) {
      refreshWalletBalance(activeWalletName, wallets[activeWalletName]);
      showSnackbar('Refreshing balance...', 'info');
    }
  }, [activeWalletName, wallets, refreshWalletBalance, showSnackbar]);

  const setupElectronMenuHandlers = useCallback(() => {
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
  }, [isUnlocked, activeWalletName, handleRefreshBalance]);

  const cleanupElectronMenuHandlers = useCallback(() => {
    if (window.electronAPI) {
      window.electronAPI.removeAllListeners('menu-new-wallet');
      window.electronAPI.removeAllListeners('menu-import-wallet');
      window.electronAPI.removeAllListeners('menu-send-transaction');
      window.electronAPI.removeAllListeners('menu-receive');
      window.electronAPI.removeAllListeners('menu-refresh-balance');
    }
  }, []);

  // Initialize app on mount
  useEffect(() => {
    initializeApp();
    setupElectronMenuHandlers();

    return () => {
      cleanupElectronMenuHandlers();
      // Clear cached encryption key when app closes
      clearKey();
    };
  }, [initializeApp, setupElectronMenuHandlers, cleanupElectronMenuHandlers]);

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
        setCustomWalletOrder(storage.wallet_order || []);

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

        // Refresh balances in parallel - Web Worker now prevents UI blocking during encryption
        setTimeout(() => {
          console.log('[Performance] Starting parallel balance refresh for all wallets');
          const walletNames = Object.keys(storage.wallets || {});

          // Refresh all balances in parallel for much faster startup
          // Web Worker handles PBKDF2 operations async, so no UI blocking
          const refreshPromises = walletNames.map(walletName =>
            refreshWalletBalance(walletName, storage.wallets[walletName], password)
              .catch(error => {
                console.error(`[Performance] Failed to refresh balance for ${walletName}:`, error);
                // Don't throw to avoid stopping other wallet refreshes
                return null;
              })
          );

          // Wait for all balance refreshes to complete (or fail gracefully)
          Promise.all(refreshPromises).then(results => {
            const successful = results.filter(result => result !== null).length;
            console.log(`[Performance] Parallel balance refresh completed: ${successful}/${walletNames.length} wallets updated`);
          }).catch(error => {
            console.warn('[Performance] Some wallet balance refreshes failed:', error);
          });
        }, 300); // Reduced delay since no blocking operations
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

  const handleWalletSelect = (walletName) => {
    // Clear any pending wallet selection to prevent rapid clicking cascade
    if (walletSelectTimeoutRef.current) {
      clearTimeout(walletSelectTimeoutRef.current);
    }

    // Debounce wallet selection to prevent performance issues from rapid clicks
    walletSelectTimeoutRef.current = setTimeout(() => {
      console.log('[Performance] Debounced wallet selection:', walletName);
      setActiveWalletName(walletName);
      showSnackbar(`Switched to wallet '${walletName}'`, 'info');
    }, 300); // 300ms debounce - prevents cascade operations while keeping UI responsive
  };

  const handleRenameWallet = async (oldName, newName) => {
    try {
      const storage = await renameWallet(masterPassword, oldName, newName);

      // Update state
      setWallets(storage.wallets);
      setActiveWalletName(storage.active_wallet);
      setAddressBook(storage.address_book);

      // Clear renaming state
      setRenamingWallet(null);

      showSnackbar(`Wallet renamed to '${newName}'`, 'success');
    } catch (error) {
      showSnackbar('Failed to rename wallet: ' + error.message, 'error');
    }
  };


  // Memoize walletList for custom ordering
  const walletList = useMemo(() => {
    const walletArray = Object.values(wallets);

    if (customWalletOrder.length > 0) {
      // Use custom order if available
      const orderedWallets = [];
      const remainingWallets = [...walletArray];

      // First, add wallets in the custom order
      customWalletOrder.forEach(walletName => {
        const walletIndex = remainingWallets.findIndex(w => w.name === walletName);
        if (walletIndex !== -1) {
          orderedWallets.push(remainingWallets[walletIndex]);
          remainingWallets.splice(walletIndex, 1);
        }
      });

      // Then add any remaining wallets (new ones not in the custom order yet)
      orderedWallets.push(...remainingWallets);

      return orderedWallets;
    }

    // Default order (order of addition)
    return walletArray;
  }, [wallets, customWalletOrder]);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = walletList.findIndex(wallet => wallet.name === active.id);
      const newIndex = walletList.findIndex(wallet => wallet.name === over.id);

      const newOrder = arrayMove(walletList, oldIndex, newIndex).map(wallet => wallet.name);

      // Only update UI state - save will happen when exiting lock mode
      setCustomWalletOrder(newOrder);
    }
  }, [walletList]);

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
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

            {walletList.length > 0 && (
              <Button
                fullWidth
                variant={editMode ? "contained" : "outlined"}
                startIcon={editMode ? <LockOpen /> : <Lock />}
                onClick={async () => {
                  const newEditMode = !editMode;

                  // Save wallet order when exiting edit mode
                  if (editMode && !newEditMode && customWalletOrder.length > 0) {
                    if (masterPassword) {
                      try {
                        await updateWalletOrder(masterPassword, customWalletOrder);
                      } catch (error) {
                        console.error('Failed to save wallet order:', error);
                        showSnackbar('Failed to save wallet order', 'error');
                      }
                    } else {
                      console.warn('Cannot save wallet order: master password not available');
                      showSnackbar('Cannot save wallet order: session expired', 'warning');
                    }
                  }

                  setEditMode(newEditMode);
                }}
                size="small"
                sx={{
                  mb: 1,
                  color: editMode ? 'white' : 'text.secondary',
                  borderColor: editMode ? 'primary.main' : 'rgba(255, 255, 255, 0.23)'
                }}
              >
                {editMode ? 'Exit Edit Mode' : 'Edit Mode'}
              </Button>
            )}
          </Box>


          {/* Wallet List */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={walletList.map(w => w.name)} strategy={verticalListSortingStrategy}>
              <List sx={{ flexGrow: 1, px: 1 }}>
                {walletList.length === 0 ? (
                  <ListItem>
                    <Typography variant="body2" color="text.secondary">
                      No wallets yet. Create your first wallet above.
                    </Typography>
                  </ListItem>
                ) : (
                  walletList.map((wallet) => (
                    <SortableWalletItem
                      key={wallet.name}
                      wallet={wallet}
                      isDragDisabled={!editMode || renamingWallet === wallet.name}
                    >
                      <ListItem disablePadding sx={{ mb: 1 }}>
                  {renamingWallet === wallet.name ? (
                    // Rename mode
                    <Box sx={{ width: '100%', p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                      <TextField
                        fullWidth
                        size="small"
                        defaultValue={wallet.name}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRenameWallet(wallet.name, e.target.value);
                          } else if (e.key === 'Escape') {
                            setRenamingWallet(null);
                          }
                        }}
                        InputProps={{
                          endAdornment: (
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  const input = e.target.closest('.MuiTextField-root').querySelector('input');
                                  handleRenameWallet(wallet.name, input.value);
                                }}
                              >
                                <Check fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => setRenamingWallet(null)}
                              >
                                <Close fontSize="small" />
                              </IconButton>
                            </Box>
                          )
                        }}
                      />
                    </Box>
                  ) : (
                    // Normal mode
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
                        position: 'relative'
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
                                color={wallet.network === 'mainnet' ? 'success' : 'warning'}
                                variant="outlined"
                              />
                              <Box>
                                <Typography
                                  variant="caption"
                                  color={wallet.name === activeWalletName ? "inherit" : "primary.main"}
                                  fontWeight="medium"
                                >
                                  {(() => {
                                    const balance = balances[wallet.name] || wallet.balance || '0';
                                    const reserves = calculateReserves(balance);
                                    return reserves.availableBalance;
                                  })()} XRP
                                </Typography>
                                <Typography
                                  variant="caption"
                                  display="block"
                                  color={wallet.name === activeWalletName ? "rgba(255, 255, 255, 0.7)" : "text.secondary"}
                                >
                                  Available
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                        }
                      />
                      {editMode && (
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingWallet(wallet.name);
                          }}
                          sx={{
                            position: 'absolute',
                            right: 8,
                            top: 8,
                            opacity: 0.8,
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            '&:hover': {
                              opacity: 1,
                              backgroundColor: 'rgba(255, 255, 255, 0.2)'
                            }
                          }}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                      )}
                    </ListItemButton>
                  )}
                      </ListItem>
                    </SortableWalletItem>
                  ))
                )}
              </List>
            </SortableContext>
          </DndContext>
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
                      (activeWallet.network === 'testnet' ? <Science /> : <AccountBalanceWallet />)}
                    label={isOperationLoading('networkConnection', activeWallet.name) ?
                      'Connecting...' : activeWallet.network}
                    color={activeWallet.network === 'mainnet' ? 'success' : 'warning'}
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

      </Box>
    </ThemeProvider>
  );
}

export default App;
