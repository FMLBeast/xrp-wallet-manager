import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Alert,
  Grid,
  InputAdornment,
  Tooltip
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  ContentCopy,
  Launch,
  Search,
  Person,
  AccountBalanceWallet
} from '@mui/icons-material';
import { isValidAddress, isValidDestinationTag, getAccountExplorerUrl } from '../utils/xrplWallet';

export default function AddressBookManager({
  addressBook,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  onShowSnackbar,
  network = 'testnet'
}) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newEntry, setNewEntry] = useState({
    label: '',
    address: '',
    destination_tag: '',
    notes: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const filteredEntries = addressBook.filter(entry =>
    entry.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setNewEntry({
      label: '',
      address: '',
      destination_tag: '',
      notes: ''
    });
    setErrors({});
    setEditingEntry(null);
  };

  const handleOpenAddDialog = () => {
    resetForm();
    setShowAddDialog(true);
  };

  const handleOpenEditDialog = (entry) => {
    setNewEntry({
      label: entry.label,
      address: entry.address,
      destination_tag: entry.destination_tag || '',
      notes: entry.notes || ''
    });
    setEditingEntry(entry);
    setShowAddDialog(true);
  };

  const handleCloseDialog = () => {
    setShowAddDialog(false);
    resetForm();
  };

  const validateForm = () => {
    const newErrors = {};

    if (!newEntry.label.trim()) {
      newErrors.label = 'Label is required';
    } else if (newEntry.label.length < 2) {
      newErrors.label = 'Label must be at least 2 characters';
    }

    if (!newEntry.address.trim()) {
      newErrors.address = 'Address is required';
    } else if (!isValidAddress(newEntry.address)) {
      newErrors.address = 'Invalid XRP address format';
    }

    if (newEntry.destination_tag && !isValidDestinationTag(newEntry.destination_tag)) {
      newErrors.destination_tag = 'Invalid destination tag';
    }

    // Check for duplicate labels (excluding current entry when editing)
    const existingEntry = addressBook.find(entry =>
      entry.label.toLowerCase() === newEntry.label.toLowerCase() &&
      (!editingEntry || entry.label !== editingEntry.label)
    );
    if (existingEntry) {
      newErrors.label = 'Label already exists';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveEntry = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const entryData = {
        label: newEntry.label.trim(),
        address: newEntry.address.trim(),
        destination_tag: newEntry.destination_tag.trim() || null,
        notes: newEntry.notes.trim() || null
      };

      if (editingEntry) {
        await onUpdateEntry(editingEntry.label, entryData);
        onShowSnackbar(`Updated contact "${entryData.label}"`, 'success');
      } else {
        await onAddEntry(entryData);
        onShowSnackbar(`Added contact "${entryData.label}"`, 'success');
      }

      handleCloseDialog();
    } catch (error) {
      onShowSnackbar(`Failed to save contact: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEntry = async (entry) => {
    if (window.confirm(`Delete contact "${entry.label}"?`)) {
      try {
        await onDeleteEntry(entry.label);
        onShowSnackbar(`Deleted contact "${entry.label}"`, 'success');
      } catch (error) {
        onShowSnackbar(`Failed to delete contact: ${error.message}`, 'error');
      }
    }
  };

  const handleCopyAddress = async (address) => {
    try {
      await navigator.clipboard.writeText(address);
      onShowSnackbar('Address copied to clipboard', 'success');
    } catch (error) {
      onShowSnackbar('Failed to copy address', 'error');
    }
  };

  const handleViewInExplorer = (address) => {
    const url = getAccountExplorerUrl(network, address);
    window.open(url, '_blank');
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">
          Address Book ({addressBook.length} contacts)
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleOpenAddDialog}
        >
          Add Contact
        </Button>
      </Box>

      {/* Search */}
      <TextField
        fullWidth
        placeholder="Search contacts..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search />
            </InputAdornment>
          )
        }}
        sx={{ mb: 3 }}
      />

      {/* Address Book Table */}
      {filteredEntries.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Person sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {addressBook.length === 0 ? 'No Contacts Yet' : 'No Matching Contacts'}
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              {addressBook.length === 0
                ? 'Add your first contact to get started.'
                : 'Try adjusting your search terms.'
              }
            </Typography>
            {addressBook.length === 0 && (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleOpenAddDialog}
              >
                Add First Contact
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Name</strong></TableCell>
                <TableCell><strong>Address</strong></TableCell>
                <TableCell><strong>Destination Tag</strong></TableCell>
                <TableCell><strong>Notes</strong></TableCell>
                <TableCell align="right"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredEntries.map((entry, index) => (
                <TableRow key={index} hover>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <AccountBalanceWallet fontSize="small" />
                      <Typography variant="body2" fontWeight="medium">
                        {entry.label}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                      >
                        {entry.address.slice(0, 20)}...
                      </Typography>
                      <Tooltip title="Copy Address">
                        <IconButton
                          size="small"
                          onClick={() => handleCopyAddress(entry.address)}
                        >
                          <ContentCopy fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {entry.destination_tag ? (
                      <Chip
                        label={entry.destination_tag}
                        size="small"
                        variant="outlined"
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        None
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {entry.notes ? (
                      <Tooltip title={entry.notes}>
                        <Typography
                          variant="body2"
                          sx={{
                            maxWidth: 150,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {entry.notes}
                        </Typography>
                      </Tooltip>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No notes
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Box display="flex" gap={0.5}>
                      <Tooltip title="View in Explorer">
                        <IconButton
                          size="small"
                          onClick={() => handleViewInExplorer(entry.address)}
                        >
                          <Launch fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit Contact">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenEditDialog(entry)}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Contact">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteEntry(entry)}
                          color="error"
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add/Edit Dialog */}
      <Dialog
        open={showAddDialog}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingEntry ? 'Edit Contact' : 'Add New Contact'}
        </DialogTitle>
        <DialogContent>
          <Box mt={1}>
            <TextField
              fullWidth
              label="Contact Name"
              value={newEntry.label}
              onChange={(e) => setNewEntry({ ...newEntry, label: e.target.value })}
              error={!!errors.label}
              helperText={errors.label}
              margin="normal"
              autoFocus
            />

            <TextField
              fullWidth
              label="XRP Address"
              value={newEntry.address}
              onChange={(e) => setNewEntry({ ...newEntry, address: e.target.value })}
              error={!!errors.address}
              helperText={errors.address}
              margin="normal"
              placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
            />

            <TextField
              fullWidth
              label="Destination Tag (Optional)"
              value={newEntry.destination_tag}
              onChange={(e) => setNewEntry({ ...newEntry, destination_tag: e.target.value })}
              error={!!errors.destination_tag}
              helperText={errors.destination_tag || 'Required by some exchanges'}
              margin="normal"
              type="number"
              inputProps={{ min: 0, max: 4294967295 }}
            />

            <TextField
              fullWidth
              label="Notes (Optional)"
              value={newEntry.notes}
              onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
              margin="normal"
              multiline
              rows={3}
              placeholder="Additional notes about this contact..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSaveEntry}
            variant="contained"
            disabled={loading}
          >
            {editingEntry ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}