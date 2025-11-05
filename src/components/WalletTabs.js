import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Alert,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress
} from '@mui/material';
import {
  ContentCopy,
  Launch,
  Refresh,
  Send,
  ExpandMore,
  AccountBalanceWallet,
  NetworkCheck,
  Science,
  Security,
  Settings,
  Download,
  Visibility,
  VisibilityOff
} from '@mui/icons-material';

// Import our new components
import TransactionConfirmDialog from './TransactionConfirmDialog';
import QRCodeDisplay from './QRCodeDisplay';
import AddressBookManager from './AddressBookManager';
import TransactionHistory from './TransactionHistory';
import MultiSigTab from './MultiSigTab';
import PasswordPromptDialog from './PasswordPromptDialog';

// Import utilities
import {
  createClient,
  preparePayment,
  signAndSubmit,
  formatAmount,
  createWalletFromSecret,
  validateAmount,
  isValidAddress,
  validateAddressForNetwork,
  isValidDestinationTag,
  getNetworkConfig,
  getAccountExplorerUrl
} from '../utils/xrplWallet';

import {
  addAddressBookEntry,
  removeAddressBookEntry,
  exportWalletData,
  exportWalletSecrets,
  updateWalletNetwork
} from '../utils/walletStorage';

const WalletTabs = ({
  selectedTab,
  wallet,
  balance,
  onRefreshBalance,
  onShowSnackbar,
  onTabChange,
  addressBook = [],
  masterPassword,
  onWalletUpdate,
  onAddressBookChange,
  loadingStates = {},
  isOperationLoading = () => false
}) => {
  // Transaction state
  const [sendForm, setSendForm] = useState({
    destination: '',
    amount: '',
    destinationTag: '',
    memo: ''
  });

  // Address book selection state
  const [selectedAddressBookItem, setSelectedAddressBookItem] = useState('');
  const [sendLoading, setSendLoading] = useState(false);
  const [sendErrors, setSendErrors] = useState({});
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [preparedTransaction, setPreparedTransaction] = useState(null);

  // Address book state
  const [localAddressBook, setLocalAddressBook] = useState(addressBook || []);

  // Settings state
  const [showSecrets, setShowSecrets] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportSecretsLoading, setExportSecretsLoading] = useState(false);
  const [networkSwitchLoading, setNetworkSwitchLoading] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authDialogPurpose, setAuthDialogPurpose] = useState(null);
  const [authDialogError, setAuthDialogError] = useState('');
  const [authDialogLoading, setAuthDialogLoading] = useState(false);

  useEffect(() => {
    setLocalAddressBook(addressBook || []);
  }, [addressBook]);

  const syncAddressBookState = (entries = []) => {
    setLocalAddressBook(entries);
    if (onAddressBookChange) {
      onAddressBookChange(entries);
    }
  };

  const handleSendFormChange = (field, value) => {
    setSendForm(prev => ({ ...prev, [field]: value }));

    // Clear error for this field
    if (sendErrors[field]) {
      setSendErrors(prev => ({ ...prev, [field]: '' }));
    }

    // Clear address book selection when destination is manually changed
    if (field === 'destination') {
      // Check if the new value matches any address in the address book
      const matchingContact = addressBook.find(contact => contact.address === value);
      if (matchingContact) {
        setSelectedAddressBookItem(matchingContact.label);
      } else {
        setSelectedAddressBookItem('');
      }
    }
  };

  const validateSendForm = () => {
    const errors = {};

    // Validate destination with network compatibility
    if (!sendForm.destination) {
      errors.destination = 'Destination address is required';
    } else {
      const addressValidation = validateAddressForNetwork(sendForm.destination, wallet?.network || 'mainnet');
      if (!addressValidation.valid) {
        errors.destination = addressValidation.error;
      } else if (addressValidation.warning) {
        // Store warning to display separately if needed
        console.log('[Network Warning]', addressValidation.warning);
      }
    }

    // Validate amount
    const amountValidation = validateAmount(sendForm.amount);
    if (!amountValidation.isValid) {
      errors.amount = amountValidation.error;
    }

    // Check sufficient balance
    const totalCost = parseFloat(sendForm.amount || 0) + 0.000012; // Approximate fee
    if (balance && parseFloat(balance) < totalCost) {
      errors.amount = 'Insufficient balance for transaction';
    }

    // Validate destination tag (optional)
    if (sendForm.destinationTag && !isValidDestinationTag(sendForm.destinationTag)) {
      errors.destinationTag = 'Invalid destination tag format';
    }

    setSendErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePrepareSend = async () => {
    if (!validateSendForm()) {
      return;
    }

    setSendLoading(true);
    if (isOperationLoading) {
      // Use centralized loading state management
      // This will be handled by the parent component
    }

    try {
      const client = createClient(wallet.network);
      await client.connect();

      // Create wallet instance from stored secret
      const walletInstance = createWalletFromSecret(wallet.secret);

      // Prepare transaction
      const prepared = await preparePayment(
        client,
        walletInstance.wallet,
        sendForm.destination,
        sendForm.amount,
        sendForm.destinationTag || null
      );

      await client.disconnect();

      if (prepared.success) {
        setPreparedTransaction({
          ...prepared,
          destination: sendForm.destination,
          amount: sendForm.amount,
          destinationTag: sendForm.destinationTag,
          memo: sendForm.memo
        });
        setShowConfirmDialog(true);
      } else {
        onShowSnackbar('Failed to prepare transaction: ' + prepared.error, 'error');
      }
    } catch (error) {
      onShowSnackbar('Failed to prepare transaction: ' + error.message, 'error');
    } finally {
      setSendLoading(false);
    }
  };

  const handleConfirmSend = async () => {
    if (!preparedTransaction) return;

    try {
      const client = createClient(wallet.network);
      await client.connect();

      // Create wallet instance
      const walletInstance = createWalletFromSecret(wallet.secret);

      // Sign and submit transaction
      const result = await signAndSubmit(client, walletInstance.wallet, preparedTransaction.transaction);

      await client.disconnect();

      if (result.success) {
        onShowSnackbar(`Transaction sent! Hash: ${result.hash}`, 'success');
        setShowConfirmDialog(false);
        setSendForm({
          destination: '',
          amount: '',
          destinationTag: '',
          memo: ''
        });
        // Refresh balance after successful transaction
        setTimeout(onRefreshBalance, 2000);
      } else {
        onShowSnackbar('Transaction failed: ' + result.error, 'error');
      }
    } catch (error) {
      onShowSnackbar('Transaction failed: ' + error.message, 'error');
    }
  };

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(wallet.address);
      onShowSnackbar('Address copied to clipboard', 'success');
    } catch (error) {
      onShowSnackbar('Failed to copy address', 'error');
    }
  };

  const handleViewInExplorer = () => {
    const url = getAccountExplorerUrl(wallet.network, wallet.address);
    window.open(url, '_blank');
  };

  const downloadJson = (data, fileName) => {
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const performWalletInfoExport = async (password) => {
    if (!wallet) {
      throw new Error('No wallet selected');
    }
    setExportLoading(true);
    try {
      const exportData = await exportWalletData(password);
      const selectedWallet = exportData.wallets?.[wallet.name];
      if (!selectedWallet) {
        throw new Error('Wallet data not found in storage');
      }

      const { secret, secret_type, ...publicData } = selectedWallet;
      downloadJson({
        wallet: publicData,
        exported_at: exportData.exported_at
      }, `${wallet.name}-export.json`);

      onShowSnackbar('Wallet exported successfully', 'success');
    } finally {
      setExportLoading(false);
    }
  };

  const performWalletSecretsExport = async (password) => {
    if (!wallet) {
      throw new Error('No wallet selected');
    }
    setExportSecretsLoading(true);
    try {
      const secretsData = await exportWalletSecrets(password, wallet.name);
      secretsData.warning = 'KEEP THIS FILE SECURE! Contains private keys that control your funds.';
      downloadJson(secretsData, `${wallet.name}-secrets.json`);
      onShowSnackbar('Wallet secrets exported successfully', 'success');
    } finally {
      setExportSecretsLoading(false);
    }
  };

  const triggerSensitiveAction = (purpose) => {
    if (!wallet) {
      onShowSnackbar('Select a wallet before exporting.', 'error');
      return;
    }
    if (!masterPassword) {
      onShowSnackbar('Unlock the application before exporting data.', 'error');
      return;
    }
    setAuthDialogPurpose(purpose);
    setAuthDialogError('');
    setAuthDialogOpen(true);
  };

  const handleSensitiveAction = async (password) => {
    if (!authDialogPurpose || !wallet) {
      return;
    }
    setAuthDialogLoading(true);
    setAuthDialogError('');
    try {
      if (authDialogPurpose === 'wallet-info') {
        await performWalletInfoExport(password);
      } else if (authDialogPurpose === 'wallet-secrets') {
        await performWalletSecretsExport(password);
      }
      setAuthDialogOpen(false);
    } catch (error) {
      const message = error.message === 'Invalid master password' ? 'Invalid master password' : error.message;
      setAuthDialogError(message);
    } finally {
      setAuthDialogLoading(false);
    }
  };

  const handleAddressBookAdd = async (entry) => {
    try {
      const storage = await addAddressBookEntry(masterPassword, entry);
      syncAddressBookState(storage.address_book);
      onShowSnackbar(`Added contact "${entry.label}"`, 'success');
    } catch (error) {
      onShowSnackbar(`Failed to add contact: ${error.message}`, 'error');
    }
  };

  const handleAddressBookUpdate = async (oldLabel, entry) => {
    try {
      await removeAddressBookEntry(masterPassword, oldLabel);
      const storage = await addAddressBookEntry(masterPassword, entry);
      syncAddressBookState(storage.address_book);
      onShowSnackbar(`Updated contact "${entry.label}"`, 'success');
    } catch (error) {
      onShowSnackbar(`Failed to update contact: ${error.message}`, 'error');
    }
  };

  const handleAddressBookDelete = async (label) => {
    try {
      const storage = await removeAddressBookEntry(masterPassword, label);
      syncAddressBookState(storage.address_book);
      onShowSnackbar(`Deleted contact "${label}"`, 'success');
    } catch (error) {
      onShowSnackbar(`Failed to delete contact: ${error.message}`, 'error');
    }
  };

  const handleNetworkChange = async (event) => {
    const newNetwork = event.target.value;
    setNetworkSwitchLoading(true);

    try {
      await updateWalletNetwork(masterPassword, wallet.name, newNetwork);
      if (onWalletUpdate) {
        onWalletUpdate(wallet.name, { network: newNetwork });
      }
      onShowSnackbar(`Switched to ${newNetwork} network`, 'success');
      onRefreshBalance();
    } catch (error) {
      onShowSnackbar(`Failed to switch network: ${error.message}`, 'error');
    } finally {
      setNetworkSwitchLoading(false);
    }
  };

  const handleExportWallet = () => {
    triggerSensitiveAction('wallet-info');
  };

  const handleExportSecrets = () => {
    triggerSensitiveAction('wallet-secrets');
  };

  // Render different tabs based on selectedTab
  const renderTabContent = () => {
    switch (selectedTab) {
      case 0: // Wallet Overview
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card elevation={3}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Wallet Information
                  </Typography>

                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell><strong>Name</strong></TableCell>
                        <TableCell>{wallet.name}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Address</strong></TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                              {wallet.address}
                            </Typography>
                            <IconButton size="small" onClick={handleCopyAddress}>
                              <ContentCopy fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Balance</strong></TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="h6" color="primary">
                              {isOperationLoading('accountInfo', wallet?.name) ? 'Loading...' : `${balance} XRP`}
                            </Typography>
                            {isOperationLoading('accountInfo', wallet?.name) && (
                              <CircularProgress size={20} />
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Network</strong></TableCell>
                        <TableCell>
                          <Chip
                            label={wallet.network}
                            color={wallet.network === 'mainnet' ? 'primary' : 'secondary'}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Algorithm</strong></TableCell>
                        <TableCell>
                          <Chip
                            label={wallet.algorithm}
                            color={wallet.algorithm === 'ed25519' ? 'primary' : 'secondary'}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>

                  <Box mt={2} display="flex" gap={1}>
                    <Button
                      variant="outlined"
                      startIcon={<Launch />}
                      onClick={handleViewInExplorer}
                      size="small"
                    >
                      View in Explorer
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={isOperationLoading('balanceRefresh', wallet?.name) ? <CircularProgress size={16} /> : <Refresh />}
                      onClick={onRefreshBalance}
                      disabled={isOperationLoading('balanceRefresh', wallet?.name)}
                      size="small"
                    >
                      {isOperationLoading('balanceRefresh', wallet?.name) ? 'Refreshing...' : 'Refresh'}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card elevation={3}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Quick Actions
                  </Typography>

                  <List>
                    <ListItem button onClick={() => onTabChange && onTabChange(1)}>
                      <ListItemIcon>
                        <Send />
                      </ListItemIcon>
                      <ListItemText
                        primary="Send XRP"
                        secondary="Send XRP to another address"
                      />
                    </ListItem>
                    <ListItem button onClick={() => onTabChange && onTabChange(2)}>
                      <ListItemIcon>
                        <AccountBalanceWallet />
                      </ListItemIcon>
                      <ListItemText
                        primary="Receive XRP"
                        secondary="Generate QR code for receiving"
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        );

      case 1: // Send
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Card elevation={3}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Send XRP
                  </Typography>

                  <Box mb={2}>
                    <TextField
                      fullWidth
                      label="Destination Address"
                      placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                      value={sendForm.destination}
                      onChange={(e) => handleSendFormChange('destination', e.target.value)}
                      error={!!sendErrors.destination}
                      helperText={sendErrors.destination}
                      margin="normal"
                    />
                    {addressBook.length > 0 && (
                      <FormControl fullWidth margin="normal">
                        <InputLabel>Quick Select from Address Book</InputLabel>
                        <Select
                          value={selectedAddressBookItem}
                          onChange={(e) => {
                            const selectedLabel = e.target.value;
                            setSelectedAddressBookItem(selectedLabel);

                            const contact = addressBook.find(c => c.label === selectedLabel);
                            if (contact) {
                              handleSendFormChange('destination', contact.address);
                              if (contact.destination_tag) {
                                handleSendFormChange('destinationTag', contact.destination_tag);
                              }
                            }
                          }}
                          label="Quick Select from Address Book"
                        >
                          {addressBook.map((contact) => (
                            <MenuItem key={contact.label} value={contact.label}>
                              <Box>
                                <Typography variant="body2">{contact.label}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {contact.address.slice(0, 20)}...
                                  {contact.destination_tag && ` (Tag: ${contact.destination_tag})`}
                                </Typography>
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  </Box>

                  <TextField
                    fullWidth
                    label="Amount"
                    placeholder="0.000000"
                    value={sendForm.amount}
                    onChange={(e) => handleSendFormChange('amount', e.target.value)}
                    error={!!sendErrors.amount}
                    helperText={sendErrors.amount}
                    margin="normal"
                    type="number"
                    inputProps={{ step: '0.000001', min: '0' }}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">XRP</InputAdornment>
                    }}
                  />

                  <TextField
                    fullWidth
                    label="Destination Tag (Optional)"
                    placeholder="Enter destination tag..."
                    value={sendForm.destinationTag}
                    onChange={(e) => handleSendFormChange('destinationTag', e.target.value)}
                    error={!!sendErrors.destinationTag}
                    helperText={sendErrors.destinationTag || 'Required by some exchanges'}
                    margin="normal"
                    type="number"
                  />

                  <TextField
                    fullWidth
                    label="Memo (Optional)"
                    placeholder="Transaction description..."
                    value={sendForm.memo}
                    onChange={(e) => handleSendFormChange('memo', e.target.value)}
                    margin="normal"
                    multiline
                    rows={2}
                  />

                  <Box mt={3} display="flex" justifyContent="flex-end">
                    <Button
                      variant="contained"
                      onClick={handlePrepareSend}
                      disabled={sendLoading || isOperationLoading('sendingTransaction') || !sendForm.destination || !sendForm.amount}
                      startIcon={(sendLoading || isOperationLoading('sendingTransaction')) ? <CircularProgress size={16} color="inherit" /> : <Send />}
                      size="large"
                    >
                      {(sendLoading || isOperationLoading('sendingTransaction')) ? 'Preparing...' : 'Send XRP'}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Transaction Summary
                  </Typography>

                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell>Current Balance</TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            {isOperationLoading('accountInfo', wallet?.name) ? 'Loading...' : `${balance} XRP`}
                            {isOperationLoading('accountInfo', wallet?.name) && (
                              <CircularProgress size={16} />
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Send Amount</TableCell>
                        <TableCell>{sendForm.amount || '0'} XRP</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Network Fee</TableCell>
                        <TableCell>~0.000012 XRP</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Remaining</strong></TableCell>
                        <TableCell>
                          <strong>
                            {(parseFloat(balance || 0) - parseFloat(sendForm.amount || 0) - 0.000012).toFixed(6)} XRP
                          </strong>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        );

      case 2: // Receive
        return <QRCodeDisplay wallet={wallet} onShowSnackbar={onShowSnackbar} />;

      case 3: // History
        return (
          <TransactionHistory
            wallet={wallet}
            onShowSnackbar={onShowSnackbar}
            isLoading={isOperationLoading('transactionHistory', wallet?.name)}
            onLoadingChange={(operation, key, isLoading) => {
              // This will be handled by App.js through the centralized loading state
            }}
          />
        );

      case 4: // Multi-Sig
        return (
          <MultiSigTab
            wallet={wallet}
            masterPassword={masterPassword}
            onShowSnackbar={onShowSnackbar}
          />
        );

      case 5: // Address Book
        return (
          <AddressBookManager
            addressBook={localAddressBook}
            onAddEntry={handleAddressBookAdd}
            onUpdateEntry={handleAddressBookUpdate}
            onDeleteEntry={handleAddressBookDelete}
            onShowSnackbar={onShowSnackbar}
            network={wallet.network}
          />
        );

      case 6: // Settings
        return (
          <Grid container spacing={3}>
            {/* Network Settings */}
            <Grid item xs={12} md={6}>
              <Card elevation={3}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Network Settings
                  </Typography>

                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      Changing network will update this wallet's configuration. Your balance will be refreshed.
                    </Typography>
                  </Alert>

                  <FormControl fullWidth margin="normal">
                    <InputLabel>Network</InputLabel>
                    <Select
                      value={wallet.network}
                      onChange={handleNetworkChange}
                      label="Network"
                      disabled={networkSwitchLoading}
                    >
                      <MenuItem value="mainnet">
                        <Box display="flex" alignItems="center" gap={1}>
                          <NetworkCheck color="primary" />
                          <Box>
                            <Typography>Mainnet</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Live XRP Ledger network
                            </Typography>
                          </Box>
                        </Box>
                      </MenuItem>
                      <MenuItem value="testnet">
                        <Box display="flex" alignItems="center" gap={1}>
                          <Science color="secondary" />
                          <Box>
                            <Typography>Testnet</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Development and testing network
                            </Typography>
                          </Box>
                        </Box>
                      </MenuItem>
                      <MenuItem value="devnet">
                        <Box display="flex" alignItems="center" gap={1}>
                          <NetworkCheck color="warning" />
                          <Box>
                            <Typography>Devnet</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Developer preview network
                            </Typography>
                          </Box>
                        </Box>
                      </MenuItem>
                    </Select>
                  </FormControl>

                  {networkSwitchLoading && (
                    <Box mt={2} display="flex" alignItems="center" gap={1}>
                      <CircularProgress size={16} />
                      <Typography variant="body2">Switching network...</Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card elevation={3}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Wallet Security
                  </Typography>

                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      Never share your private keys or seed phrase. Keep them secure and backed up.
                    </Typography>
                  </Alert>

                  <Box mb={2}>
                    <Button
                      variant="outlined"
                      startIcon={showSecrets ? <VisibilityOff /> : <Visibility />}
                      onClick={() => setShowSecrets(!showSecrets)}
                      fullWidth
                    >
                      {showSecrets ? 'Hide' : 'Show'} Wallet Secrets
                    </Button>
                  </Box>

                  {showSecrets && (
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Private Key / Seed
                      </Typography>
                      <TextField
                        fullWidth
                        value={wallet.secret}
                        InputProps={{ readOnly: true, style: { fontFamily: 'monospace' } }}
                        size="small"
                        multiline
                      />
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card elevation={3}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Export & Backup
                  </Typography>

                  <Typography variant="body2" color="text.secondary" paragraph>
                    Export your wallet information for backup purposes. This includes your encrypted wallet data.
                  </Typography>

                  <Box display="flex" gap={2}>
                    <Button
                      variant="contained"
                      startIcon={<Download />}
                      onClick={handleExportWallet}
                      disabled={exportLoading}
                    >
                      {exportLoading ? 'Exporting...' : 'Export Wallet Info'}
                    </Button>

                    <Button
                      variant="outlined"
                      startIcon={<Security />}
                      onClick={handleExportSecrets}
                      disabled={exportSecretsLoading}
                    >
                      {exportSecretsLoading ? 'Exporting...' : 'Export Secrets'}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        );

      default:
        return <Alert severity="error">Unknown tab</Alert>;
    }
  };

  if (!wallet) {
    return (
      <Alert severity="info">
        No wallet selected. Please select or create a wallet.
      </Alert>
    );
  }

  return (
    <Box>
      {renderTabContent()}

      {/* Transaction Confirmation Dialog */}
      <TransactionConfirmDialog
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={handleConfirmSend}
        transaction={preparedTransaction}
        wallet={wallet}
        balance={balance}
      />

      <PasswordPromptDialog
        open={authDialogOpen}
        title={authDialogPurpose === 'wallet-secrets' ? 'Export Wallet Secrets' : 'Export Wallet Info'}
        description="Enter your master password to continue."
        loading={authDialogLoading || exportLoading || exportSecretsLoading}
        error={authDialogError}
        onCancel={() => {
          if (!authDialogLoading) {
            setAuthDialogOpen(false);
            setAuthDialogError('');
          }
        }}
        onSubmit={handleSensitiveAction}
      />
    </Box>
  );
};

export default WalletTabs;
