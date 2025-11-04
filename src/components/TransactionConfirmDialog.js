import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableRow
} from '@mui/material';
import {
  Send,
  Security,
  Warning,
  AccountBalanceWallet,
  NetworkCheck,
  Schedule
} from '@mui/icons-material';
import { formatAmount } from '../utils/xrplWallet';

export default function TransactionConfirmDialog({
  open,
  onClose,
  onConfirm,
  transaction,
  wallet,
  loading = false
}) {
  const [confirming, setConfirming] = useState(false);

  if (!transaction || !wallet) return null;

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  const totalAmount = parseFloat(transaction.amount) + parseFloat(transaction.fee);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={confirming}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Send color="primary" />
          <Typography variant="h6">
            Confirm Transaction
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box mt={2}>
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Warning:</strong> This transaction cannot be undone. Please verify all details carefully.
            </Typography>
          </Alert>

          {/* Transaction Summary */}
          <Card elevation={2} sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Transaction Summary
              </Typography>

              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell><strong>From</strong></TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <AccountBalanceWallet fontSize="small" />
                        <Box>
                          <Typography variant="body2">{wallet.name}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                            {wallet.address}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell><strong>To</strong></TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {transaction.destination}
                      </Typography>
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell><strong>Amount</strong></TableCell>
                    <TableCell>
                      <Typography variant="h6" color="primary">
                        {transaction.amount} XRP
                      </Typography>
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell><strong>Network Fee</strong></TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {transaction.fee} XRP
                      </Typography>
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell><strong>Total Cost</strong></TableCell>
                    <TableCell>
                      <Typography variant="h6" color="error">
                        {totalAmount.toFixed(6)} XRP
                      </Typography>
                    </TableCell>
                  </TableRow>

                  {transaction.destinationTag && (
                    <TableRow>
                      <TableCell><strong>Destination Tag</strong></TableCell>
                      <TableCell>
                        <Chip label={transaction.destinationTag} size="small" />
                      </TableCell>
                    </TableRow>
                  )}

                  {transaction.memo && (
                    <TableRow>
                      <TableCell><strong>Memo</strong></TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {transaction.memo}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Network Information */}
          <Card elevation={2} sx={{ mb: 3 }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <NetworkCheck color="primary" />
                <Typography variant="h6">
                  Network Details
                </Typography>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Network
                  </Typography>
                  <Chip
                    label={wallet.network}
                    color={wallet.network === 'mainnet' ? 'primary' : 'secondary'}
                    size="small"
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Algorithm
                  </Typography>
                  <Chip
                    label={wallet.algorithm}
                    color={wallet.algorithm === 'ed25519' ? 'primary' : 'secondary'}
                    size="small"
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Transaction Type
                  </Typography>
                  <Typography variant="body2">Payment</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Sequence Number
                  </Typography>
                  <Typography variant="body2">{transaction.sequence || 'Auto'}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Security Notice */}
          <Card elevation={2} sx={{ mb: 2 }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Security color="success" />
                <Typography variant="h6">
                  Security Information
                </Typography>
              </Box>

              <Typography variant="body2" paragraph>
                This transaction will be cryptographically signed with your wallet's private key
                using the {wallet.algorithm} algorithm. The signature proves ownership and prevents tampering.
              </Typography>

              <Typography variant="body2" color="text.secondary">
                Once submitted to the XRP Ledger, this transaction cannot be reversed or cancelled.
              </Typography>
            </CardContent>
          </Card>

          {/* Balance Warning */}
          {wallet.balance && parseFloat(wallet.balance) < totalAmount && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Insufficient Balance:</strong> Your current balance
                ({formatAmount(wallet.balance)} XRP) is less than the total transaction cost
                ({totalAmount.toFixed(6)} XRP).
              </Typography>
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button
          onClick={onClose}
          disabled={confirming}
          size="large"
        >
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={confirming || (wallet.balance && parseFloat(wallet.balance) < totalAmount)}
          startIcon={confirming ? <CircularProgress size={16} /> : <Send />}
          size="large"
          color="primary"
        >
          {confirming ? 'Submitting...' : 'Confirm & Send'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}