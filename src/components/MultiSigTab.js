import React, { useState, useEffect } from 'react';
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
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Divider,
  Stepper,
  Step,
  StepLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Add,
  Delete,
  Security,
  People,
  Check,
  Warning,
  Info,
  ExpandMore,
  AccountBalance,
  VpnKey,
  Send
} from '@mui/icons-material';
import { createClient, preparePayment, signAndSubmit, getAccountInfo, isValidAddress } from '../utils/xrplWallet';
import { Wallet } from 'xrpl';

export default function MultiSigTab({ wallet, onShowSnackbar, masterPassword }) {
  const [signerLists, setSignerLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [pendingTransactions, setPendingTransactions] = useState([]);

  // Create Signer List state
  const [signers, setSigners] = useState([{ address: '', weight: 1 }]);
  const [quorum, setQuorum] = useState(1);
  const [createLoading, setCreateLoading] = useState(false);

  // Transaction signing state
  const [transactionBlob, setTransactionBlob] = useState('');
  const [signedTransactions, setSignedTransactions] = useState([]);

  useEffect(() => {
    if (wallet) {
      loadSignerLists();
      loadPendingTransactions();
    }
  }, [wallet]);

  const loadSignerLists = async () => {
    if (!wallet) return;

    setLoading(true);
    try {
      const client = createClient(wallet.network);
      await client.connect();

      const accountInfo = await client.request({
        command: 'account_objects',
        account: wallet.address,
        type: 'signer_list'
      });

      if (accountInfo.result && accountInfo.result.account_objects) {
        setSignerLists(accountInfo.result.account_objects);
      }

      await client.disconnect();
    } catch (error) {
      console.error('Failed to load signer lists:', error);
      onShowSnackbar('Failed to load multi-sig configuration', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadPendingTransactions = () => {
    // In a real implementation, this would load from a shared storage or server
    // For now, we'll use local storage as a demo
    try {
      const stored = localStorage.getItem(`pending_transactions_${wallet.address}`);
      if (stored) {
        setPendingTransactions(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load pending transactions:', error);
    }
  };

  const savePendingTransactions = (transactions) => {
    try {
      localStorage.setItem(`pending_transactions_${wallet.address}`, JSON.stringify(transactions));
      setPendingTransactions(transactions);
    } catch (error) {
      console.error('Failed to save pending transactions:', error);
    }
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
      const walletInstance = wallet.wallet || { address: wallet.address, publicKey: wallet.public_key };

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
      const client = createClient(wallet.network);
      await client.connect();

      // Combine signatures and submit
      // This is a simplified implementation - real multi-sig requires careful signature aggregation
      const result = await client.submit(signatures[0].signature);

      if (result.result.engine_result === 'tesSUCCESS') {
        onShowSnackbar('Multi-signed transaction submitted successfully!', 'success');
        // Remove from pending
        const newPending = pendingTransactions.filter(tx => tx.id !== signatures[0].id);
        savePendingTransactions(newPending);
      } else {
        throw new Error(result.result.engine_result_message || 'Transaction failed');
      }

      await client.disconnect();
    } catch (error) {
      console.error('Failed to submit multi-signed transaction:', error);
      onShowSnackbar(`Failed to submit transaction: ${error.message}`, 'error');
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
              <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                <AccountBalance />
                Current Configuration
              </Typography>

              {signerLists.length === 0 ? (
                <Alert severity="info">
                  No multi-signature configuration found. This wallet uses single-signature transactions.
                </Alert>
              ) : (
                signerLists.map((signerList, index) => (
                  <Box key={index}>
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
                ))
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
                  <Send />
                  Pending Transactions
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
                pendingTransactions.map((tx) => (
                  <Accordion key={tx.id}>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Box>
                        <Typography variant="body1">
                          {tx.type || 'Transaction'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(tx.timestamp).toLocaleString()}
                        </Typography>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {JSON.stringify(tx.transaction, null, 2)}
                      </Typography>
                      <Box mt={2}>
                        <Typography variant="body2" gutterBottom>
                          Signatures: {tx.signatures?.length || 0}
                        </Typography>
                        {tx.signatures?.map((sig, index) => (
                          <Chip
                            key={index}
                            label={`${sig.signer.slice(0, 8)}...`}
                            size="small"
                            color="success"
                            sx={{ mr: 1, mb: 1 }}
                          />
                        ))}
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                ))
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

      {/* Create Signer List Dialog */}
      <Dialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Setup Multi-Signature Configuration
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" paragraph sx={{ mt: 1 }}>
            Configure the addresses and weights for your multi-signature wallet.
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
          >
            Add Signer
          </Button>

          <Alert severity="info" sx={{ mt: 2 }}>
            Total Weight: {signers.reduce((sum, s) => sum + s.weight, 0)} |
            Quorum: {quorum} |
            Required Signatures: {Math.ceil(quorum / Math.max(...signers.map(s => s.weight), 1))}+
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateSignerList}
            variant="contained"
            disabled={createLoading}
          >
            {createLoading ? 'Creating...' : 'Create Multi-Sig Configuration'}
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
    </Box>
  );
}
