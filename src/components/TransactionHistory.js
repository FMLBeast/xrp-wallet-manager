import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment
} from '@mui/material';
import {
  Refresh,
  Launch,
  ArrowUpward,
  ArrowDownward,
  Info,
  Search
} from '@mui/icons-material';
import { formatAmount, getExplorerUrl, createClient } from '../utils/xrplWallet';

export default function TransactionHistory({
  wallet,
  onShowSnackbar,
  isLoading = false,
  onLoadingChange
}) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(50);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const loadTransactionHistory = useCallback(async () => {
    if (!wallet) return;

    setLoading(true);
    if (onLoadingChange) {
      onLoadingChange('transactionHistory', wallet.name, true);
    }
    try {
      const client = createClient(wallet.network);
      await client.connect();

      const response = await client.request({
        command: 'account_tx',
        account: wallet.address,
        limit: limit,
        ledger_index_min: -1,
        ledger_index_max: -1
      });

      await client.disconnect();

      if (response.result && response.result.transactions) {
        const processedTxs = response.result.transactions.map(tx => ({
          hash: tx.tx.hash,
          type: tx.tx.TransactionType,
          date: tx.tx.date ? new Date((tx.tx.date + 946684800) * 1000) : null,
          fee: formatAmount(tx.tx.Fee),
          sequence: tx.tx.Sequence,
          account: tx.tx.Account,
          destination: tx.tx.Destination,
          amount: tx.tx.Amount,
          destination_tag: tx.tx.DestinationTag,
          source_tag: tx.tx.SourceTag,
          memos: tx.tx.Memos,
          validated: tx.validated,
          ledger_index: tx.ledger_index,
          meta: tx.meta,
          raw: tx
        }));

        setTransactions(processedTxs);
      }
    } catch (error) {
      console.error('Failed to load transaction history:', error);
      onShowSnackbar('Failed to load transaction history: ' + error.message, 'error');
    } finally {
      setLoading(false);
      if (onLoadingChange) {
        onLoadingChange('transactionHistory', wallet.name, false);
      }
    }
  }, [wallet, limit, onLoadingChange, onShowSnackbar]);

  useEffect(() => {
    if (wallet) {
      loadTransactionHistory();
    }
  }, [wallet, loadTransactionHistory]);

  const getTransactionDirection = (tx) => {
    if (tx.account === wallet.address) {
      return 'outgoing';
    } else if (tx.destination === wallet.address) {
      return 'incoming';
    }
    return 'other';
  };

  const getTransactionAmount = (tx) => {
    if (typeof tx.amount === 'string') {
      return formatAmount(tx.amount);
    } else if (tx.amount && typeof tx.amount === 'object') {
      // Currency amount (not XRP)
      return `${tx.amount.value} ${tx.amount.currency}`;
    }
    return '0';
  };

  const getTransactionStatus = (tx) => {
    if (tx.validated) {
      if (tx.meta && tx.meta.TransactionResult === 'tesSUCCESS') {
        return 'success';
      } else {
        return 'failed';
      }
    }
    return 'pending';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success':
        return 'success';
      case 'failed':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatDate = (date) => {
    if (!date) return 'Unknown';
    return date.toLocaleString();
  };

  const handleViewInExplorer = (hash) => {
    const url = getExplorerUrl(wallet.network, hash);
    window.open(url, '_blank');
  };

  const filteredTransactions = transactions.filter(tx => {
    const direction = getTransactionDirection(tx);
    const matchesFilter = filter === 'all' ||
      (filter === 'incoming' && direction === 'incoming') ||
      (filter === 'outgoing' && direction === 'outgoing') ||
      (filter === 'payment' && tx.type === 'Payment') ||
      (filter === 'other' && tx.type !== 'Payment');

    const matchesSearch = !searchTerm ||
      tx.hash.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.destination && tx.destination.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (tx.account && tx.account.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesFilter && matchesSearch;
  });

  if (!wallet) {
    return (
      <Alert severity="info">
        Select a wallet to view transaction history.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">
          Transaction History ({transactions.length} total)
        </Typography>
        <Button
          variant="outlined"
          startIcon={(loading || isLoading) ? <CircularProgress size={16} /> : <Refresh />}
          onClick={loadTransactionHistory}
          disabled={loading || isLoading}
        >
          {(loading || isLoading) ? 'Loading...' : 'Refresh'}
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Filter</InputLabel>
              <Select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                label="Filter"
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="incoming">Incoming</MenuItem>
                <MenuItem value="outgoing">Outgoing</MenuItem>
                <MenuItem value="payment">Payments</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Limit</InputLabel>
              <Select
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                label="Limit"
              >
                <MenuItem value={25}>25</MenuItem>
                <MenuItem value={50}>50</MenuItem>
                <MenuItem value={100}>100</MenuItem>
                <MenuItem value={200}>200</MenuItem>
              </Select>
            </FormControl>

            <TextField
              size="small"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                )
              }}
              sx={{ flexGrow: 1, maxWidth: 300 }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Transaction Table */}
      {filteredTransactions.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Info sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {transactions.length === 0 ? 'No Transactions Yet' : 'No Matching Transactions'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {transactions.length === 0
                ? 'This wallet has no transaction history.'
                : 'Try adjusting your filters or search terms.'
              }
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Type</strong></TableCell>
                <TableCell><strong>Direction</strong></TableCell>
                <TableCell><strong>Amount</strong></TableCell>
                <TableCell><strong>From/To</strong></TableCell>
                <TableCell><strong>Date</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTransactions.map((tx, index) => {
                const direction = getTransactionDirection(tx);
                const amount = getTransactionAmount(tx);
                const status = getTransactionStatus(tx);

                return (
                  <TableRow key={index} hover>
                    <TableCell>
                      <Chip
                        label={tx.type}
                        size="small"
                        color={tx.type === 'Payment' ? 'primary' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        {direction === 'incoming' ? (
                          <ArrowDownward color="success" fontSize="small" />
                        ) : direction === 'outgoing' ? (
                          <ArrowUpward color="error" fontSize="small" />
                        ) : (
                          <Info color="info" fontSize="small" />
                        )}
                        <Typography variant="body2" color={
                          direction === 'incoming' ? 'success.main' :
                          direction === 'outgoing' ? 'error.main' : 'text.secondary'
                        }>
                          {direction === 'incoming' ? 'Received' :
                           direction === 'outgoing' ? 'Sent' : 'Other'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {amount} XRP
                      </Typography>
                      {tx.fee && (
                        <Typography variant="caption" color="text.secondary">
                          Fee: {tx.fee} XRP
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                      >
                        {direction === 'incoming'
                          ? `${tx.account?.slice(0, 12)}...`
                          : `${tx.destination?.slice(0, 12)}...`
                        }
                      </Typography>
                      {(tx.destination_tag || tx.source_tag) && (
                        <Chip
                          label={`Tag: ${tx.destination_tag || tx.source_tag}`}
                          size="small"
                          variant="outlined"
                          sx={{ mt: 0.5 }}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(tx.date)}
                      </Typography>
                      {tx.ledger_index && (
                        <Typography variant="caption" color="text.secondary">
                          Ledger: {tx.ledger_index}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={status}
                        size="small"
                        color={getStatusColor(status)}
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View in Explorer">
                        <IconButton
                          size="small"
                          onClick={() => handleViewInExplorer(tx.hash)}
                        >
                          <Launch fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {filteredTransactions.length > 0 && (
        <Box mt={2} textAlign="center">
          <Typography variant="body2" color="text.secondary">
            Showing {filteredTransactions.length} of {transactions.length} transactions
          </Typography>
        </Box>
      )}
    </Box>
  );
}