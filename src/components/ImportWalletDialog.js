import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  Box,
  Typography,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  Grid,
  Divider
} from '@mui/material';
import { Add, AccountBalanceWallet, Security, NetworkCheck, Science } from '@mui/icons-material';
import { createWalletFromSecret, generateTestWallet } from '../utils/xrplWallet';

const steps = ['Enter Secret', 'Configure Wallet', 'Confirm Import'];

export default function ImportWalletDialog({
  open,
  onClose,
  onImport,
  loading = false
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [secret, setSecret] = useState('');
  const [walletName, setWalletName] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState('testnet');
  const [walletInfo, setWalletInfo] = useState(null);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [generatingTestWallet, setGeneratingTestWallet] = useState(false);

  useEffect(() => {
    if (open) {
      // Reset form
      setActiveStep(0);
      setSecret('');
      setWalletName('');
      setSelectedNetwork('testnet');
      setWalletInfo(null);
      setError('');
      setValidationError('');
    }
  }, [open]);

  const handleSecretChange = (e) => {
    const newSecret = e.target.value.trim();
    setSecret(newSecret);
    setValidationError('');

    if (newSecret) {
      try {
        const info = createWalletFromSecret(newSecret);
        setWalletInfo(info);
        setWalletName(info.suggested_name || '');
      } catch (error) {
        setWalletInfo(null);
        setValidationError(error.message);
      }
    } else {
      setWalletInfo(null);
    }
  };

  const handleGenerateTestWallet = async () => {
    setError('');
    setGeneratingTestWallet(true);
    try {
      const testWallet = await generateTestWallet();
      setSecret(testWallet.secret);
      setWalletInfo(testWallet);
      setWalletName(testWallet.suggested_name || 'Test Wallet');
      setSelectedNetwork('testnet');
    } catch (error) {
      setError('Failed to generate test wallet: ' + error.message);
    } finally {
      setGeneratingTestWallet(false);
    }
  };

  const handleNext = () => {
    if (activeStep === 0) {
      // Validate secret
      if (!secret) {
        setValidationError('Please enter a wallet secret or generate a test wallet');
        return;
      }
      if (!walletInfo) {
        setValidationError('Invalid wallet secret format');
        return;
      }
    } else if (activeStep === 1) {
      // Validate wallet configuration
      if (!walletName.trim()) {
        setValidationError('Please enter a wallet name');
        return;
      }
      if (walletName.trim().length < 3) {
        setValidationError('Wallet name must be at least 3 characters long');
        return;
      }
    }

    setValidationError('');
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setValidationError('');
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleImport = () => {
    if (!walletInfo || !walletName.trim()) {
      setValidationError('Missing required information');
      return;
    }

    const walletData = {
      name: walletName.trim(),
      network: selectedNetwork,
      address: walletInfo.address,
      secret: secret,
      secret_type: walletInfo.secret_type,
      public_key: walletInfo.public_key,
      algorithm: walletInfo.algorithm,
      balance: '0'
    };

    onImport(walletData);
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box>
            <Typography variant="body1" paragraph>
              Import an existing wallet by entering your seed phrase, private key, or mnemonic.
              You can also generate a new test wallet for development.
            </Typography>

            <TextField
              fullWidth
              label="Wallet Secret"
              placeholder="Enter seed phrase, private key, or mnemonic..."
              value={secret}
              onChange={handleSecretChange}
              margin="normal"
              multiline
              rows={3}
              disabled={loading}
              helperText="Supported formats: seed phrase (12/24 words), hex private key, or family seed (s...)"
            />

            <Box mt={2} mb={2} display="flex" justifyContent="center">
              <Button
                variant="outlined"
                onClick={handleGenerateTestWallet}
                startIcon={generatingTestWallet ? <CircularProgress size={16} /> : <Add />}
                disabled={loading || generatingTestWallet}
              >
                {generatingTestWallet ? 'Generating...' : 'Generate Test Wallet'}
              </Button>
            </Box>

            {walletInfo && (
              <Card elevation={2} sx={{ mt: 2 }}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <Security color="success" />
                    <Typography variant="h6" color="success.main">
                      Valid Wallet Detected
                    </Typography>
                  </Box>

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        Algorithm
                      </Typography>
                      <Chip
                        label={walletInfo.algorithm}
                        color={walletInfo.algorithm === 'ed25519' ? 'primary' : 'secondary'}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        Secret Type
                      </Typography>
                      <Typography variant="body1">{walletInfo.secret_type}</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">
                        Address
                      </Typography>
                      <Typography variant="body1" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        {walletInfo.address}
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">
                        Public Key
                      </Typography>
                      <Typography variant="body1" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        {walletInfo.public_key}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            )}
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="body1" paragraph>
              Configure your wallet settings.
            </Typography>

            <TextField
              fullWidth
              label="Wallet Name"
              value={walletName}
              onChange={(e) => setWalletName(e.target.value)}
              margin="normal"
              disabled={loading}
              helperText="Choose a unique name to identify this wallet"
            />

            <FormControl fullWidth margin="normal">
              <InputLabel>Network</InputLabel>
              <Select
                value={selectedNetwork}
                onChange={(e) => setSelectedNetwork(e.target.value)}
                label="Network"
                disabled={loading}
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

            <Alert severity="info" sx={{ mt: 2 }}>
              {selectedNetwork === 'mainnet' ? (
                'You are connecting to the live XRP Ledger. Real XRP will be used for transactions.'
              ) : (
                `You are connecting to ${selectedNetwork}. This network uses test XRP with no real value.`
              )}
            </Alert>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="body1" paragraph>
              Review your wallet configuration before importing.
            </Typography>

            <Card elevation={2}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <AccountBalanceWallet color="primary" />
                  <Typography variant="h6">
                    {walletName}
                  </Typography>
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Network
                    </Typography>
                    <Chip
                      label={selectedNetwork}
                      color={selectedNetwork === 'mainnet' ? 'primary' : 'secondary'}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Algorithm
                    </Typography>
                    <Chip
                      label={walletInfo?.algorithm}
                      color={walletInfo?.algorithm === 'ed25519' ? 'primary' : 'secondary'}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      Address
                    </Typography>
                    <Typography variant="body1" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      {walletInfo?.address}
                    </Typography>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />

                <Alert severity="warning">
                  <Typography variant="body2">
                    Make sure you have safely stored your wallet secret.
                    This import will encrypt and store your wallet locally.
                  </Typography>
                </Alert>
              </CardContent>
            </Card>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={loading}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Add color="primary" />
          <Typography variant="h6">
            Import Wallet
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box mt={2}>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {renderStepContent()}

          {(error || validationError) && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {validationError || error}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>

        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={loading}>
            Back
          </Button>
        )}

        {activeStep < steps.length - 1 ? (
          <Button
            onClick={handleNext}
            variant="contained"
            disabled={loading || (activeStep === 0 && !walletInfo)}
          >
            Next
          </Button>
        ) : (
          <Button
            onClick={handleImport}
            variant="contained"
            disabled={loading || !walletInfo || !walletName.trim()}
            startIcon={loading && <CircularProgress size={16} />}
          >
            {loading ? 'Importing...' : 'Import Wallet'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}