import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Alert
} from '@mui/material';

export default function PasswordPromptDialog({
  open,
  title = 'Confirm Password',
  description = 'Enter your master password to continue.',
  loading = false,
  error = '',
  onSubmit,
  onCancel
}) {
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (open) {
      setPassword('');
    }
  }, [open]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (onSubmit) {
      onSubmit(password);
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onCancel} maxWidth="xs" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" paragraph>
            {description}
          </Typography>

          <TextField
            type="password"
            label="Master Password"
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            margin="dense"
            disabled={loading}
          />

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading || !password}>
            {loading ? 'Verifying...' : 'Confirm'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
