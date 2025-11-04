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
  InputAdornment,
  IconButton,
  LinearProgress
} from '@mui/material';
import { Visibility, VisibilityOff, Security } from '@mui/icons-material';

function validatePassword(password) {
  const errors = [];

  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

function calculatePasswordStrength(password) {
  let score = 0;

  // Length
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Character types
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  // Patterns
  if (!/(.)\1{2,}/.test(password)) score += 1; // No repeated characters
  if (!/123|abc|qwe|asd|zxc/i.test(password)) score += 1; // No common patterns

  return Math.min(score, 5);
}

function getStrengthColor(strength) {
  switch (strength) {
    case 0:
    case 1:
      return 'error';
    case 2:
      return 'warning';
    case 3:
      return 'info';
    case 4:
    case 5:
      return 'success';
    default:
      return 'error';
  }
}

function getStrengthText(strength) {
  switch (strength) {
    case 0:
    case 1:
      return 'Very Weak';
    case 2:
      return 'Weak';
    case 3:
      return 'Fair';
    case 4:
      return 'Strong';
    case 5:
      return 'Very Strong';
    default:
      return 'Very Weak';
  }
}

export default function MasterPasswordDialog({
  open,
  onSubmit,
  onCancel,
  onReset,
  mode = 'unlock',
  loading = false,
  error = ''
}) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationError, setValidationError] = useState('');

  const isCreateMode = mode === 'create';
  const passwordStrength = calculatePasswordStrength(password);

  useEffect(() => {
    if (open) {
      setPassword('');
      setConfirmPassword('');
      setValidationError('');
    }
  }, [open]);

  const handleSubmit = () => {
    setValidationError('');

    if (!password) {
      setValidationError('Password is required');
      return;
    }

    if (isCreateMode) {
      // Validate password strength for creation
      const validation = validatePassword(password);
      if (!validation.isValid) {
        setValidationError(validation.errors[0]);
        return;
      }

      // Check password confirmation
      if (password !== confirmPassword) {
        setValidationError('Passwords do not match');
        return;
      }
    }

    onSubmit(password);
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={!isCreateMode} // Prevent escape in unlock mode
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Security color="primary" />
          <Typography variant="h6">
            {isCreateMode ? 'Create Master Password' : 'Unlock Wallet'}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box mt={1}>
          {isCreateMode ? (
            <Typography variant="body2" color="text.secondary" paragraph>
              Create a strong master password to protect your wallets. This password encrypts
              all your wallet data and cannot be recovered if lost.
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary" paragraph>
              Enter your master password to unlock your encrypted wallets.
            </Typography>
          )}

          <TextField
            autoFocus
            fullWidth
            label="Master Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={handleKeyPress}
            margin="normal"
            disabled={loading}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          {isCreateMode && password && (
            <Box mt={1} mb={2}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                <Typography variant="caption" color="text.secondary">
                  Password Strength
                </Typography>
                <Typography variant="caption" color={`${getStrengthColor(passwordStrength)}.main`}>
                  {getStrengthText(passwordStrength)}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={(passwordStrength / 5) * 100}
                color={getStrengthColor(passwordStrength)}
                sx={{ height: 6, borderRadius: 3 }}
              />
            </Box>
          )}

          {isCreateMode && (
            <TextField
              fullWidth
              label="Confirm Password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              margin="normal"
              disabled={loading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      edge="end"
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          )}

          {(error || validationError) && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {validationError || error}
              {!isCreateMode && error.includes('Invalid') && (
                <Box mt={1}>
                  <Typography variant="caption" color="text.secondary">
                    Can't remember your password? You can reset all wallet data to start fresh.
                  </Typography>
                </Box>
              )}
            </Alert>
          )}

          {isCreateMode && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Important:</strong> Store your master password safely. If you lose it,
                your wallets cannot be recovered. Consider using a password manager.
              </Typography>
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Box display="flex" justifyContent="space-between" width="100%">
          <Box>
            {!isCreateMode && error.includes('Invalid') && onReset && (
              <Button
                onClick={onReset}
                disabled={loading}
                color="error"
                size="small"
              >
                Reset All Data
              </Button>
            )}
          </Box>
          <Box display="flex" gap={1}>
            {isCreateMode && (
              <Button onClick={onCancel} disabled={loading}>
                Cancel
              </Button>
            )}
            <Button
              onClick={handleSubmit}
              variant="contained"
              disabled={loading || !password || (isCreateMode && !confirmPassword)}
              startIcon={loading && <CircularProgress size={16} />}
            >
              {loading ? 'Processing...' : (isCreateMode ? 'Create Password' : 'Unlock')}
            </Button>
          </Box>
        </Box>
      </DialogActions>
    </Dialog>
  );
}