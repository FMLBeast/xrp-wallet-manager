import React, { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  IconButton,
  Grid,
  Alert,
  Chip,
  InputAdornment,
  Tooltip
} from '@mui/material';
import {
  ContentCopy,
  Download,
  Share,
  QrCode2,
  Refresh
} from '@mui/icons-material';

export default function QRCodeDisplay({ wallet, onShowSnackbar }) {
  const [amount, setAmount] = useState('');
  const [destinationTag, setDestinationTag] = useState('');
  const [memo, setMemo] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [paymentUrl, setPaymentUrl] = useState('');

  const generateQRCode = useCallback(async () => {
    if (!wallet) return;

    // Create XRP payment URL
    let url = `https://xrpl.org/?to=${wallet.address}`;

    if (amount) {
      url += `&amount=${amount}`;
    }

    if (destinationTag) {
      url += `&dt=${destinationTag}`;
    }

    if (memo) {
      url += `&memo=${encodeURIComponent(memo)}`;
    }

    setPaymentUrl(url);

    try {
      // Generate QR code locally as data URL
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });
      setQrCodeUrl(qrDataUrl);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      // Fallback to external service if local generation fails
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&format=png&data=${encodeURIComponent(url)}`;
      setQrCodeUrl(qrUrl);
    }
  }, [wallet, amount, destinationTag, memo]);

  useEffect(() => {
    generateQRCode();
  }, [generateQRCode]);

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(wallet.address);
      onShowSnackbar('Address copied to clipboard', 'success');
    } catch (error) {
      onShowSnackbar('Failed to copy address', 'error');
    }
  };

  const handleCopyPaymentUrl = async () => {
    try {
      await navigator.clipboard.writeText(paymentUrl);
      onShowSnackbar('Payment URL copied to clipboard', 'success');
    } catch (error) {
      onShowSnackbar('Failed to copy payment URL', 'error');
    }
  };

  const handleDownloadQR = () => {
    if (!qrCodeUrl) {
      onShowSnackbar('QR code not ready. Please wait...', 'warning');
      return;
    }

    try {
      const link = document.createElement('a');
      link.href = qrCodeUrl;
      link.download = `xrp-qr-${wallet.name.replace(/[^a-zA-Z0-9]/g, '-')}.png`;

      // Ensure the link doesn't navigate away from the app
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      onShowSnackbar('QR code downloaded successfully', 'success');
    } catch (error) {
      console.error('Failed to download QR code:', error);
      onShowSnackbar('Failed to download QR code', 'error');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'XRP Payment Request',
          text: `Send XRP to ${wallet.name}`,
          url: paymentUrl
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          onShowSnackbar('Failed to share', 'error');
        }
      }
    } else {
      // Fallback to copying URL
      handleCopyPaymentUrl();
    }
  };

  if (!wallet) {
    return (
      <Alert severity="info">
        Select a wallet to generate QR code for receiving payments.
      </Alert>
    );
  }

  return (
    <Grid container spacing={3}>
      {/* QR Code Display */}
      <Grid item xs={12} md={6}>
        <Card elevation={3}>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              Payment QR Code
            </Typography>

            {qrCodeUrl ? (
              <Box>
                <img
                  src={qrCodeUrl}
                  alt="Payment QR Code"
                  style={{
                    maxWidth: '100%',
                    height: 'auto',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    marginBottom: '16px'
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    onShowSnackbar('Failed to load QR code', 'error');
                  }}
                />

                <Box display="flex" justifyContent="center" gap={1}>
                  <Tooltip title="Download QR Code">
                    <IconButton onClick={handleDownloadQR} color="primary">
                      <Download />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Share Payment URL">
                    <IconButton onClick={handleShare} color="primary">
                      <Share />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Regenerate QR Code">
                    <IconButton onClick={generateQRCode} color="primary">
                      <Refresh />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            ) : (
              <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                minHeight={200}
              >
                <QrCode2 sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  Generating QR code...
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Payment Request Form */}
      <Grid item xs={12} md={6}>
        <Card elevation={3}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Payment Request Details
            </Typography>

            {/* Wallet Info */}
            <Box mb={3}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Receiving Wallet
              </Typography>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Chip label={wallet.name} color="primary" />
                <Chip
                  label={wallet.network}
                  color={wallet.network === 'mainnet' ? 'primary' : 'secondary'}
                  size="small"
                />
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography
                  variant="body2"
                  sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
                >
                  {wallet.address}
                </Typography>
                <Tooltip title="Copy Address">
                  <IconButton size="small" onClick={handleCopyAddress}>
                    <ContentCopy fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* Amount Field */}
            <TextField
              fullWidth
              label="Amount (Optional)"
              placeholder="0.000000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              margin="normal"
              type="number"
              inputProps={{
                step: '0.000001',
                min: '0'
              }}
              InputProps={{
                endAdornment: <InputAdornment position="end">XRP</InputAdornment>
              }}
              helperText="Leave empty for any amount"
            />

            {/* Destination Tag Field */}
            <TextField
              fullWidth
              label="Destination Tag (Optional)"
              placeholder="Enter destination tag..."
              value={destinationTag}
              onChange={(e) => setDestinationTag(e.target.value)}
              margin="normal"
              type="number"
              inputProps={{
                min: '0',
                max: '4294967295'
              }}
              helperText="Required by some exchanges"
            />

            {/* Memo Field */}
            <TextField
              fullWidth
              label="Memo (Optional)"
              placeholder="Payment description..."
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              margin="normal"
              multiline
              rows={2}
              inputProps={{
                maxLength: 1000
              }}
              helperText={`${memo.length}/1000 characters`}
            />

            {/* Payment URL */}
            {paymentUrl && (
              <Box mt={2}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Payment URL
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <TextField
                    fullWidth
                    value={paymentUrl}
                    InputProps={{
                      readOnly: true,
                      style: { fontSize: '0.75rem' }
                    }}
                    size="small"
                  />
                  <Tooltip title="Copy Payment URL">
                    <IconButton onClick={handleCopyPaymentUrl} color="primary">
                      <ContentCopy />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            )}

            {/* Instructions */}
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                Share this QR code or payment URL to receive XRP. The sender can scan
                the code with any XRP wallet app or visit the payment URL.
              </Typography>
            </Alert>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}