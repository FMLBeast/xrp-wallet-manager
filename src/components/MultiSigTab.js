import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Alert,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Grid,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Table,
  TableBody,
  TableCell,
  TableRow
} from '@mui/material';
import {
  Add,
  Delete,
  Security,
  Info,
  ExpandMore,
  AccountBalance,
  VpnKey,
  Send,
  NotificationsActive,
  CheckCircle,
  Schedule
} from '@mui/icons-material';
import { createClient, isValidAddress, calculateReserves, getAccountInfo } from '../utils/xrplWallet';
import { Wallet } from 'xrpl';

export default function MultiSigTab({ wallet, onShowSnackbar, masterPassword, balance, onPendingTransactionsChange }) {
  const [signerLists, setSignerLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [showRemoveMasterKeyDialog, setShowRemoveMasterKeyDialog] = useState(false);
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [accountInfo, setAccountInfo] = useState(null);

  // Create Signer List state
  const [signers, setSigners] = useState([{ address: '', weight: 1 }]);
  const [quorum, setQuorum] = useState(1);
  const [createLoading, setCreateLoading] = useState(false);
  const [setupStep, setSetupStep] = useState(0); // 0: Configure, 1: Review, 2: Confirm

  // Transaction signing state
  const [transactionBlob, setTransactionBlob] = useState('');
  const [signedTransactions, setSignedTransactions] = useState([]);

  // Master key removal state
  const [confirmMasterKeyRemoval, setConfirmMasterKeyRemoval] = useState('');
  const [removingMasterKey, setRemovingMasterKey] = useState(false);

  const loadSignerLists = useCallback(async () => {
    if (!wallet) return;

    setLoading(true);
    try {
      const client = createClient(wallet.network);
      await client.connect();

      // Load signer lists
      const signerResponse = await client.request({
        command: 'account_objects',
        account: wallet.address,
        type: 'signer_list'
      });

      if (signerResponse.result && signerResponse.result.account_objects) {
        setSignerLists(signerResponse.result.account_objects);
      }

      // Load account info for reserve calculations
      const accountResponse = await getAccountInfo(client, wallet.address);
      if (accountResponse.success) {
        setAccountInfo(accountResponse);
      }

      await client.disconnect();
    } catch (error) {
      console.error('Failed to load signer lists:', error);
      onShowSnackbar('Failed to load multi-sig configuration', 'error');
    } finally {
      setLoading(false);
    }
  }, [wallet, onShowSnackbar]);

  const loadPendingTransactions = useCallback(() => {
    // In a real implementation, this would load from a shared storage or server
    // For now, we'll use local storage as a demo
    if (!wallet) return;

    try {
      const stored = localStorage.getItem(`pending_transactions_${wallet.address}`);
      if (stored) {
        setPendingTransactions(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load pending transactions:', error);
    }
  }, [wallet]);

  useEffect(() => {
    if (wallet) {
      loadSignerLists();
      loadPendingTransactions();
    }
  }, [wallet, loadSignerLists, loadPendingTransactions]);

  // Notify parent component about pending transaction changes
  useEffect(() => {
    if (onPendingTransactionsChange) {
      const pendingCount = pendingTransactions.filter(tx => tx.status !== 'ready').length;
      const readyCount = pendingTransactions.filter(tx => tx.status === 'ready').length;
      onPendingTransactionsChange({
        total: pendingTransactions.length,
        pending: pendingCount,
        ready: readyCount
      });
    }
  }, [pendingTransactions, onPendingTransactionsChange]);

  const savePendingTransactions = (transactions) => {
    try {
      localStorage.setItem(`pending_transactions_${wallet.address}`, JSON.stringify(transactions));
      setPendingTransactions(transactions);
    } catch (error) {
      console.error('Failed to save pending transactions:', error);
    }
  };

  // Calculate MultiSig setup reserve requirements
  const calculateMultiSigReserve = () => {
    const currentBalance = parseFloat(balance || '0');
    const currentReserves = calculateReserves(balance, accountInfo?.owner_count || 0);

    // Each SignerList object requires 0.2 XRP owner reserve
    const signerListReserve = 0.2;
    const newOwnerCount = (accountInfo?.owner_count || 0) + (signerLists.length === 0 ? 1 : 0);
    const newReserves = calculateReserves(balance, newOwnerCount);

    return {
      currentReserves: parseFloat(currentReserves.totalReserve),
      newReserves: parseFloat(newReserves.totalReserve),
      additionalReserve: signerListReserve,
      currentAvailable: parseFloat(currentReserves.availableBalance),
      newAvailable: Math.max(0, currentBalance - parseFloat(newReserves.totalReserve)),
      hasEnoughBalance: currentBalance >= parseFloat(newReserves.totalReserve),
      estimatedCost: signerListReserve + 0.000012 // Reserve + transaction fee
    };
  };

  // Check if MultiSig is properly configured for master key removal
  const canRemoveMasterKey = () => {
    if (signerLists.length === 0) {
      return { canRemove: false, reason: 'No MultiSig configuration found' };
    }

    const signerList = signerLists[0];
    const signerCount = signerList.SignerEntries?.length || 0;

    if (signerCount < 2) {
      return { canRemove: false, reason: 'Need at least 2 signers for safe MultiSig operation' };
    }

    const totalWeight = signerList.SignerEntries.reduce((sum, entry) =>
      sum + entry.SignerEntry.SignerWeight, 0);
    const quorum = signerList.SignerQuorum;

    if (quorum > totalWeight) {
      return { canRemove: false, reason: 'Invalid configuration: quorum exceeds total weight' };
    }

    if (quorum === totalWeight) {
      return { canRemove: false, reason: 'All signers required - no redundancy for lost keys' };
    }

    return {
      canRemove: true,
      reason: `Safe to remove: ${signerCount} signers, quorum ${quorum}/${totalWeight}`
    };
  };

  const handleAddSigner = () => {
    setSigners([...signers, { address: '', weight: 1 }]);
  };

  const handleRemoveSigner = (index) => {
    if (signers.length > 1) {
      setSigners(signers.filter((_, i) => i !== index));
    }
  };

  const handleSignerChange = (index, field, value) => {
    const newSigners = [...signers];
    newSigners[index][field] = value;
    setSigners(newSigners);
  };

  const validateSignerList = () => {
    // Check all signers have valid addresses
    for (const signer of signers) {
      if (!signer.address || !isValidAddress(signer.address)) {
        return 'All signers must have valid XRP addresses';
      }
      if (signer.weight < 1 || signer.weight > 65535) {
        return 'Signer weights must be between 1 and 65535';
      }
    }

    // Check quorum is reasonable
    const totalWeight = signers.reduce((sum, signer) => sum + signer.weight, 0);
    if (quorum < 1 || quorum > totalWeight) {
      return `Quorum must be between 1 and ${totalWeight} (total weight)`;
    }

    // Check for duplicate addresses
    const addresses = signers.map(s => s.address);
    if (new Set(addresses).size !== addresses.length) {
      return 'Duplicate signer addresses are not allowed';
    }

    return null;
  };

  const handleCreateSignerList = async () => {
    const validation = validateSignerList();
    if (validation) {
      onShowSnackbar(validation, 'error');
      return;
    }

    // Check if there's enough balance for the reserve
    const reserveCalc = calculateMultiSigReserve();
    if (!reserveCalc.hasEnoughBalance) {
      onShowSnackbar(
        `Insufficient balance. Need ${reserveCalc.estimatedCost.toFixed(6)} XRP total (${reserveCalc.additionalReserve} XRP reserve + fees)`,
        'error'
      );
      return;
    }

    setCreateLoading(true);
    try {
      const client = createClient(wallet.network);
      await client.connect();

      // Create SignerListSet transaction
      const transaction = {
        TransactionType: 'SignerListSet',
        Account: wallet.address,
        SignerQuorum: quorum,
        SignerEntries: signers.map(signer => ({
          SignerEntry: {
            Account: signer.address,
            SignerWeight: signer.weight
          }
        }))
      };

      const prepared = await client.autofill(transaction);

      // For multi-sig setup, we need the master key
      if (wallet.secret) {
          const masterWallet = Wallet.fromSeed(wallet.secret);
        const signed = masterWallet.sign(prepared);
        const result = await client.submitAndWait(signed.tx_blob);

        if (result.result.validated) {
          onShowSnackbar('Multi-signature configuration created successfully!', 'success');
          setShowCreateDialog(false);
          loadSignerLists();
        } else {
          throw new Error('Transaction failed validation');
        }
      } else {
        throw new Error('Master key required for multi-sig setup');
      }

      await client.disconnect();
    } catch (error) {
      console.error('Failed to create signer list:', error);
      onShowSnackbar(`Failed to create multi-sig configuration: ${error.message}`, 'error');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleRemoveMasterKey = async () => {
    if (confirmMasterKeyRemoval !== 'DISABLE MASTER KEY') {
      onShowSnackbar('Please type the confirmation phrase exactly', 'error');
      return;
    }

    const safety = canRemoveMasterKey();
    if (!safety.canRemove) {
      onShowSnackbar(`Cannot remove master key: ${safety.reason}`, 'error');
      return;
    }

    setRemovingMasterKey(true);
    try {
      const client = createClient(wallet.network);
      await client.connect();

      // Create SetRegularKey transaction to disable master key
      const transaction = {
        TransactionType: 'SetRegularKey',
        Account: wallet.address,
        // Not setting RegularKey effectively disables the master key
      };

      const prepared = await client.autofill(transaction);
      const masterWallet = Wallet.fromSeed(wallet.secret);
      const signed = masterWallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.validated) {
        onShowSnackbar('Master key disabled successfully! This wallet now requires MultiSig for all transactions.', 'success');
        setShowRemoveMasterKeyDialog(false);
        setConfirmMasterKeyRemoval('');
      } else {
        throw new Error('Transaction failed validation');
      }

      await client.disconnect();
    } catch (error) {
      console.error('Failed to remove master key:', error);
      onShowSnackbar(`Failed to disable master key: ${error.message}`, 'error');
    } finally {
      setRemovingMasterKey(false);
    }
  };

  const handleSignTransaction = async () => {
    if (!transactionBlob.trim()) {
      onShowSnackbar('Please enter a transaction to sign', 'error');
      return;
    }

    try {
      const signerWallet = Wallet.fromSeed(wallet.secret);

      // Parse the transaction blob
      const txJson = JSON.parse(transactionBlob);

      // Sign the transaction
      const signed = signerWallet.sign(txJson);

      // Add to signed transactions
      const newSigned = {
        id: Date.now(),
        transaction: txJson,
        signature: signed.tx_blob,
        signer: wallet.address,
        timestamp: new Date().toISOString()
      };

      setSignedTransactions([...signedTransactions, newSigned]);
      onShowSnackbar('Transaction signed successfully', 'success');
      setTransactionBlob('');
    } catch (error) {
      console.error('Failed to sign transaction:', error);
      onShowSnackbar(`Failed to sign transaction: ${error.message}`, 'error');
    }
  };

  const handleSubmitMultiSigned = async (signatures) => {
    try {
      setLoading(true);
      const client = createClient(wallet.network);
      await client.connect();

      // Combine signatures and submit the multi-signed transaction
      // In a real implementation, this would properly aggregate multiple signatures
      if (signatures && signatures.length > 0) {
        const firstSignature = signatures[0];

        // Submit the transaction with aggregated signatures
        const result = await client.submit(firstSignature.signedTransaction);

        if (result.result.engine_result === 'tesSUCCESS') {
          onShowSnackbar('Multi-signed transaction submitted successfully!', 'success');

          // Remove from pending transactions
          const newPending = pendingTransactions.filter(tx => tx.id !== firstSignature.transactionId);
          savePendingTransactions(newPending);

          // Refresh transaction history
          loadPendingTransactions();
        } else {
          throw new Error(result.result.engine_result_message || 'Transaction failed');
        }
      } else {
        throw new Error('No valid signatures provided');
      }

      await client.disconnect();
    } catch (error) {
      console.error('Failed to submit multi-signed transaction:', error);
      onShowSnackbar(`Failed to submit transaction: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };



  if (!wallet) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography variant="h6" color="text.secondary">
          No wallet selected
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" display="flex" alignItems="center" gap={1}>
          <Security />
          Multi-Signature Wallets
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setShowCreateDialog(true)}
          disabled={loading}
        >
          Setup Multi-Sig
        </Button>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Grid container spacing={3}>
        {/* Current Multi-Sig Configuration */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" display="flex" alignItems="center" gap={1}>
                  <AccountBalance />
                  Current Configuration
                </Typography>
                {signerLists.length > 0 && (
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<Security />}
                    onClick={() => setShowRemoveMasterKeyDialog(true)}
                    disabled={!canRemoveMasterKey().canRemove}
                  >
                    Disable Master Key
                  </Button>
                )}
              </Box>

              {signerLists.length === 0 ? (
                <Alert severity="info">
                  No multi-signature configuration found. This wallet uses single-signature transactions.
                </Alert>
              ) : (
                <>
                  {signerLists.map((signerList, index) => (
                    <Box key={index} mb={2}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Quorum: {signerList.SignerQuorum}
                      </Typography>
                      <List dense>
                        {signerList.SignerEntries.map((entry, entryIndex) => (
                          <ListItem key={entryIndex}>
                            <ListItemText
                              primary={entry.SignerEntry.Account}
                              secondary={`Weight: ${entry.SignerEntry.SignerWeight}`}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  ))}

                  {/* Master Key Status */}
                  <Alert
                    severity={canRemoveMasterKey().canRemove ? "warning" : "info"}
                    sx={{ mt: 2 }}
                  >
                    <Typography variant="body2">
                      <strong>Master Key Status:</strong> {canRemoveMasterKey().reason}
                    </Typography>
                  </Alert>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Pending Transactions */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" display="flex" alignItems="center" gap={1}>
                  {pendingTransactions.length > 0 ? (
                    <NotificationsActive color="warning" />
                  ) : (
                    <Send />
                  )}
                  Pending Transactions
                  {pendingTransactions.length > 0 && (
                    <Chip
                      size="small"
                      label={pendingTransactions.length}
                      color="warning"
                      sx={{ ml: 1 }}
                    />
                  )}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<VpnKey />}
                  onClick={() => setShowSignDialog(true)}
                >
                  Sign Transaction
                </Button>
              </Box>

              {pendingTransactions.length === 0 ? (
                <Alert severity="info">
                  No pending multi-signature transactions.
                </Alert>
              ) : (
                <>
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      <strong>{pendingTransactions.length} transaction(s)</strong> requiring signatures found.
                      Review and sign to authorize transactions.
                    </Typography>
                  </Alert>

                  {pendingTransactions.map((tx) => {
                    const signaturesNeeded = tx.requiredSignatures || 2;
                    const currentSignatures = tx.signatures?.length || 0;
                    const isReady = currentSignatures >= signaturesNeeded;

                    return (
                      <Accordion key={tx.id}>
                        <AccordionSummary
                          expandIcon={<ExpandMore />}
                          sx={{
                            bgcolor: isReady ? 'success.light' : 'warning.light',
                            '&:hover': {
                              bgcolor: isReady ? 'success.main' : 'warning.main'
                            }
                          }}
                        >
                          <Box display="flex" alignItems="center" gap={2} width="100%">
                            {isReady ? (
                              <CheckCircle color="success" />
                            ) : (
                              <Schedule color="warning" />
                            )}
                            <Box flexGrow={1}>
                              <Typography variant="body1" fontWeight="medium">
                                {tx.transaction?.TransactionType || 'Transaction'}
                                {tx.transaction?.Destination && ` to ${tx.transaction.Destination.slice(0, 8)}...`}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {new Date(tx.created || tx.timestamp).toLocaleString()}
                              </Typography>
                            </Box>
                            <Box textAlign="right">
                              <Typography variant="body2" fontWeight="medium">
                                {currentSignatures}/{signaturesNeeded} signatures
                              </Typography>
                              <Chip
                                size="small"
                                label={isReady ? 'Ready' : 'Pending'}
                                color={isReady ? 'success' : 'warning'}
                              />
                            </Box>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          {tx.transaction?.Amount && (
                            <Alert severity="info" sx={{ mb: 2 }}>
                              <Typography variant="body2">
                                <strong>Amount:</strong> {parseFloat(tx.transaction.Amount) / 1000000} XRP
                                {tx.transaction.Destination && (
                                  <>
                                    <br />
                                    <strong>To:</strong> {tx.transaction.Destination}
                                  </>
                                )}
                              </Typography>
                            </Alert>
                          )}

                          <Box mb={2}>
                            <Typography variant="body2" gutterBottom fontWeight="medium">
                              Signatures ({currentSignatures}/{signaturesNeeded}):
                            </Typography>
                            {tx.signatures?.length > 0 ? (
                              tx.signatures.map((sig, index) => (
                                <Chip
                                  key={index}
                                  label={`${sig.account?.slice(0, 8) || sig.signer?.slice(0, 8)}...`}
                                  size="small"
                                  color="success"
                                  icon={<CheckCircle />}
                                  sx={{ mr: 1, mb: 1 }}
                                />
                              ))
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                No signatures yet
                              </Typography>
                            )}
                          </Box>

                          {isReady && (
                            <Button
                              variant="contained"
                              color="success"
                              startIcon={<Send />}
                              onClick={() => handleSubmitMultiSigned(tx.signatures)}
                              sx={{ mb: 2 }}
                            >
                              Submit Transaction
                            </Button>
                          )}

                          <Typography variant="body2" component="pre" sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.8rem',
                            bgcolor: 'background.paper',
                            p: 1,
                            borderRadius: 1,
                            overflow: 'auto',
                            maxHeight: 200
                          }}>
                            {JSON.stringify(tx.transaction, null, 2)}
                          </Typography>
                        </AccordionDetails>
                      </Accordion>
                    );
                  })}
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Instructions */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                <Info />
                Multi-Signature Instructions
              </Typography>
              <Typography variant="body2" paragraph>
                Multi-signature wallets require multiple signatures to authorize transactions, providing enhanced security.
              </Typography>
              <Typography variant="body2" component="div">
                <strong>Setup Process:</strong>
                <ol>
                  <li>Configure signer list with addresses and weights</li>
                  <li>Set quorum (minimum weight required for transactions)</li>
                  <li>Submit SignerListSet transaction using master key</li>
                  <li>Disable master key (optional, for maximum security)</li>
                </ol>
              </Typography>
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Important:</strong> Once multi-sig is enabled and master key disabled,
                  you'll need the configured signers to authorize any transactions.
                  Make sure all signers are accessible before disabling the master key.
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Create Signer List Dialog - Wizard Style */}
      <Dialog
        open={showCreateDialog}
        onClose={() => {
          setShowCreateDialog(false);
          setSetupStep(0);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Multi-Signature Setup Wizard
        </DialogTitle>
        <DialogContent>
          <Stepper activeStep={setupStep} orientation="vertical">
            {/* Step 1: Configure Signers */}
            <Step>
              <StepLabel>
                Configure Signers & Quorum
              </StepLabel>
              <StepContent>
                <Typography variant="body2" paragraph>
                  Set up your signer addresses and weights. The quorum determines the minimum weight needed to authorize transactions.
                </Typography>

                <TextField
                  fullWidth
                  label="Quorum (Required Weight)"
                  type="number"
                  value={quorum}
                  onChange={(e) => setQuorum(parseInt(e.target.value) || 1)}
                  margin="normal"
                  helperText="Minimum total weight required to authorize transactions"
                />

                <Typography variant="h6" gutterBottom sx={{ mt: 3, mb: 2 }}>
                  Signers
                </Typography>

                {signers.map((signer, index) => (
                  <Box key={index} display="flex" gap={2} alignItems="center" mb={2}>
                    <TextField
                      fullWidth
                      label={`Signer ${index + 1} Address`}
                      value={signer.address}
                      onChange={(e) => handleSignerChange(index, 'address', e.target.value)}
                      placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                      error={signer.address && !isValidAddress(signer.address)}
                      helperText={signer.address && !isValidAddress(signer.address) ? 'Invalid XRP address' : ''}
                    />
                    <TextField
                      label="Weight"
                      type="number"
                      value={signer.weight}
                      onChange={(e) => handleSignerChange(index, 'weight', parseInt(e.target.value) || 1)}
                      sx={{ width: 100 }}
                      inputProps={{ min: 1, max: 65535 }}
                    />
                    <IconButton
                      onClick={() => handleRemoveSigner(index)}
                      disabled={signers.length === 1}
                      color="error"
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                ))}

                <Button
                  startIcon={<Add />}
                  onClick={handleAddSigner}
                  variant="outlined"
                  size="small"
                  sx={{ mb: 2 }}
                >
                  Add Signer
                </Button>

                <Alert severity="info" sx={{ mb: 2 }}>
                  Total Weight: {signers.reduce((sum, s) => sum + s.weight, 0)} |
                  Quorum: {quorum} |
                  Required Signatures: {Math.ceil(quorum / Math.max(...signers.map(s => s.weight), 1))}+
                </Alert>

                <Box sx={{ mb: 1 }}>
                  <Button
                    variant="contained"
                    onClick={() => setSetupStep(1)}
                    disabled={validateSignerList() !== null}
                  >
                    Next: Review Configuration
                  </Button>
                  {validateSignerList() && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                      {validateSignerList()}
                    </Alert>
                  )}
                </Box>
              </StepContent>
            </Step>

            {/* Step 2: Review & Reserve Check */}
            <Step>
              <StepLabel>
                Review & Reserve Check
              </StepLabel>
              <StepContent>
                <Typography variant="body2" paragraph>
                  Review your configuration and check reserve requirements.
                </Typography>

                {/* Configuration Summary */}
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Configuration Summary
                  </Typography>
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell><strong>Number of Signers:</strong></TableCell>
                        <TableCell>{signers.length}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Total Weight:</strong></TableCell>
                        <TableCell>{signers.reduce((sum, s) => sum + s.weight, 0)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Quorum Required:</strong></TableCell>
                        <TableCell>{quorum}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Security Level:</strong></TableCell>
                        <TableCell>
                          {quorum === signers.reduce((sum, s) => sum + s.weight, 0) ? (
                            <Chip label="ALL signers required" color="warning" size="small" />
                          ) : (
                            <Chip label="Fault tolerant" color="success" size="small" />
                          )}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Alert>

                {/* Reserve Requirements */}
                {balance && accountInfo && (
                  <Alert severity={calculateMultiSigReserve().hasEnoughBalance ? "success" : "error"} sx={{ mb: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Reserve Requirements
                    </Typography>
                    {(() => {
                      const reserveCalc = calculateMultiSigReserve();
                      return (
                        <Box>
                          <Typography variant="body2" gutterBottom>
                            • Current available: <strong>{reserveCalc.currentAvailable.toFixed(6)} XRP</strong>
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            • Additional reserve: <strong>{reserveCalc.additionalReserve.toFixed(1)} XRP</strong>
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            • Total cost: <strong>{reserveCalc.estimatedCost.toFixed(6)} XRP</strong>
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            • Balance after setup: <strong>{reserveCalc.newAvailable.toFixed(6)} XRP</strong>
                          </Typography>
                          <Typography variant="body2" color={reserveCalc.hasEnoughBalance ? 'success.main' : 'error.main'}>
                            <strong>
                              {reserveCalc.hasEnoughBalance ? '✓ Sufficient balance' : '✗ Insufficient balance'}
                            </strong>
                          </Typography>
                        </Box>
                      );
                    })()}
                  </Alert>
                )}

                <Box sx={{ mt: 2, mb: 1 }}>
                  <Button
                    onClick={() => setSetupStep(0)}
                    sx={{ mr: 1 }}
                  >
                    Back
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => setSetupStep(2)}
                    disabled={!balance || !accountInfo || !calculateMultiSigReserve().hasEnoughBalance}
                  >
                    Next: Final Confirmation
                  </Button>
                </Box>
              </StepContent>
            </Step>

            {/* Step 3: Final Confirmation */}
            <Step>
              <StepLabel>
                Final Confirmation
              </StepLabel>
              <StepContent>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>⚠️ Important:</strong> After creating this MultiSig configuration:
                  </Typography>
                  <ul>
                    <li>All future transactions will require the configured signatures</li>
                    <li>Make sure all signer private keys are securely backed up</li>
                    <li>Test the configuration before disabling the master key</li>
                    <li>The {calculateMultiSigReserve().additionalReserve} XRP reserve cannot be recovered</li>
                  </ul>
                </Alert>

                <Typography variant="body2" paragraph>
                  Click "Create Configuration" to finalize your MultiSig setup.
                </Typography>

                <Box sx={{ mt: 2, mb: 1 }}>
                  <Button
                    onClick={() => setSetupStep(1)}
                    sx={{ mr: 1 }}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleCreateSignerList}
                    variant="contained"
                    color="primary"
                    disabled={createLoading}
                  >
                    {createLoading ? 'Creating Configuration...' : 'Create Configuration'}
                  </Button>
                </Box>
              </StepContent>
            </Step>
          </Stepper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowCreateDialog(false);
            setSetupStep(0);
          }}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sign Transaction Dialog */}
      <Dialog
        open={showSignDialog}
        onClose={() => setShowSignDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Sign Multi-Signature Transaction
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" paragraph sx={{ mt: 1 }}>
            Paste the transaction JSON that needs to be signed.
          </Typography>

          <TextField
            fullWidth
            label="Transaction JSON"
            multiline
            rows={8}
            value={transactionBlob}
            onChange={(e) => setTransactionBlob(e.target.value)}
            placeholder='{"TransactionType": "Payment", "Account": "...", ...}'
            sx={{ fontFamily: 'monospace' }}
          />

          {signedTransactions.length > 0 && (
            <Box mt={2}>
              <Typography variant="h6" gutterBottom>
                Signed Transactions
              </Typography>
              {signedTransactions.map((signed) => (
                <Card key={signed.id} variant="outlined" sx={{ mb: 1 }}>
                  <CardContent>
                    <Typography variant="body2">
                      Signed by: {signed.signer}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(signed.timestamp).toLocaleString()}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSignDialog(false)}>
            Close
          </Button>
          <Button
            onClick={handleSignTransaction}
            variant="contained"
            disabled={!transactionBlob.trim()}
          >
            Sign Transaction
          </Button>
        </DialogActions>
      </Dialog>

      {/* Remove Master Key Dialog */}
      <Dialog
        open={showRemoveMasterKeyDialog}
        onClose={() => setShowRemoveMasterKeyDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: 'error.main' }}>
          ⚠️ Disable Master Key
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>DANGER:</strong> This will permanently disable the master key for this wallet.
              After this action, you will ONLY be able to make transactions using the configured MultiSig signers.
            </Typography>
          </Alert>

          <Typography variant="body2" paragraph>
            Current MultiSig status: <strong>{canRemoveMasterKey().reason}</strong>
          </Typography>

          <Typography variant="body2" paragraph>
            Before proceeding, ensure that:
          </Typography>
          <ul>
            <li>All signer private keys are securely backed up</li>
            <li>You have tested the MultiSig configuration</li>
            <li>At least {Math.ceil(quorum / 2)} signers are accessible</li>
            <li>You understand this action cannot be reversed with master key only</li>
          </ul>

          <TextField
            fullWidth
            label="Type 'DISABLE MASTER KEY' to confirm"
            value={confirmMasterKeyRemoval}
            onChange={(e) => setConfirmMasterKeyRemoval(e.target.value)}
            margin="normal"
            error={confirmMasterKeyRemoval !== '' && confirmMasterKeyRemoval !== 'DISABLE MASTER KEY'}
            helperText={confirmMasterKeyRemoval !== '' && confirmMasterKeyRemoval !== 'DISABLE MASTER KEY' ?
              'Must type exactly: DISABLE MASTER KEY' : ''}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowRemoveMasterKeyDialog(false);
            setConfirmMasterKeyRemoval('');
          }}>
            Cancel
          </Button>
          <Button
            onClick={handleRemoveMasterKey}
            variant="contained"
            color="error"
            disabled={removingMasterKey || confirmMasterKeyRemoval !== 'DISABLE MASTER KEY' || !canRemoveMasterKey().canRemove}
          >
            {removingMasterKey ? 'Disabling...' : 'Disable Master Key'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
