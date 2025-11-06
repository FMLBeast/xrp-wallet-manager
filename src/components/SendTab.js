import React, { memo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress
} from '@mui/material';
import {
  QrCode2
} from '@mui/icons-material';

// Utility functions are handled by parent component
import TransactionConfirmDialog from './TransactionConfirmDialog';

const SendTab = memo(({
  wallet,
  balance,
  sendForm,
  onSendFormChange,
  sendErrors,
  addressBook,
  selectedAddressBookItem,
  onSelectedAddressBookItemChange,
  qrScanLoading,
  onQRCodeScan,
  sendLoading,
  onSendTransaction,
  showConfirmDialog,
  onShowConfirmDialog,
  preparedTransaction,
  onShowSnackbar
}) => {
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
                onChange={(e) => onSendFormChange('destination', e.target.value)}
                error={!!sendErrors.destination}
                helperText={sendErrors.destination}
                margin="normal"
              />

              {/* QR Code Import Button */}
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <input
                  accept="image/*"
                  style={{ display: 'none' }}
                  id="qr-upload-button"
                  type="file"
                  onChange={onQRCodeScan}
                />
                <label htmlFor="qr-upload-button">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={qrScanLoading ? <CircularProgress size={16} /> : <QrCode2 />}
                    disabled={qrScanLoading}
                    size="small"
                  >
                    {qrScanLoading ? 'Scanning...' : 'Scan QR Code'}
                  </Button>
                </label>
                <Typography variant="caption" color="text.secondary">
                  Upload QR code image to auto-fill form
                </Typography>
              </Box>

              {addressBook.length > 0 && (
                <FormControl fullWidth margin="normal">
                  <InputLabel>Quick Select from Address Book</InputLabel>
                  <Select
                    value={selectedAddressBookItem}
                    onChange={(e) => {
                      const selectedLabel = e.target.value;
                      onSelectedAddressBookItemChange(selectedLabel);

                      const contact = addressBook.find(c => c.label === selectedLabel);
                      if (contact) {
                        onSendFormChange('destination', contact.address);
                        if (contact.destination_tag) {
                          onSendFormChange('destinationTag', contact.destination_tag);
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
              onChange={(e) => onSendFormChange('amount', e.target.value)}
              error={!!sendErrors.amount}
              helperText={sendErrors.amount || (balance && `Available: ${balance} XRP`)}
              margin="normal"
              type="number"
              inputProps={{
                step: "0.000001",
                min: "0"
              }}
            />

            <TextField
              fullWidth
              label="Destination Tag (Optional)"
              placeholder="Enter destination tag if required"
              value={sendForm.destinationTag}
              onChange={(e) => onSendFormChange('destinationTag', e.target.value)}
              error={!!sendErrors.destinationTag}
              helperText={sendErrors.destinationTag}
              margin="normal"
              type="number"
            />

            <TextField
              fullWidth
              label="Memo (Optional)"
              placeholder="Enter memo text"
              value={sendForm.memo}
              onChange={(e) => onSendFormChange('memo', e.target.value)}
              error={!!sendErrors.memo}
              helperText={sendErrors.memo}
              margin="normal"
              multiline
              rows={2}
            />

            <Box mt={3} display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.secondary">
                Estimated Fee: ~0.000012 XRP
              </Typography>
              <Button
                variant="contained"
                onClick={onSendTransaction}
                disabled={sendLoading || !sendForm.destination || !sendForm.amount}
                sx={{ minWidth: 120 }}
              >
                {sendLoading ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  'Send XRP'
                )}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={4}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Transaction Summary
            </Typography>

            <Box mb={2}>
              <Typography variant="body2" color="text.secondary">From:</Typography>
              <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                {wallet?.name} ({wallet?.address?.slice(0, 10)}...)
              </Typography>
            </Box>

            <Box mb={2}>
              <Typography variant="body2" color="text.secondary">To:</Typography>
              <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                {sendForm.destination ? `${sendForm.destination.slice(0, 10)}...` : 'Not specified'}
              </Typography>
            </Box>

            <Box mb={2}>
              <Typography variant="body2" color="text.secondary">Amount:</Typography>
              <Typography variant="h6" color="primary">
                {sendForm.amount || '0'} XRP
              </Typography>
            </Box>

            <Box mb={2}>
              <Typography variant="body2" color="text.secondary">Current Balance:</Typography>
              <Typography variant="body1">
                {balance || '0'} XRP
              </Typography>
            </Box>

            {sendForm.destinationTag && (
              <Box mb={2}>
                <Typography variant="body2" color="text.secondary">Destination Tag:</Typography>
                <Typography variant="body1">{sendForm.destinationTag}</Typography>
              </Box>
            )}

            {sendForm.memo && (
              <Box mb={2}>
                <Typography variant="body2" color="text.secondary">Memo:</Typography>
                <Typography variant="body1">{sendForm.memo}</Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Transaction Confirmation Dialog */}
      <TransactionConfirmDialog
        open={showConfirmDialog}
        transaction={preparedTransaction}
        onConfirm={(password) => {
          // This will be handled by the parent component
          onShowConfirmDialog(false);
          // The parent will handle the actual transaction submission
        }}
        onCancel={() => onShowConfirmDialog(false)}
        onShowSnackbar={onShowSnackbar}
      />
    </Grid>
  );
});

export default SendTab;