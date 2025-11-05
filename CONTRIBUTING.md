# Contributing to XRP Wallet Manager

Thanks for your interest in improving XRP Wallet Manager! The guidelines below help us keep development smooth and consistent.

## Getting started

1. Fork the repository and create a feature branch from `main`.
2. Install Node.js (18 or higher) and dependencies:
   ```bash
   npm install
   ```
3. Launch the development environment:
   ```bash
   npm run electron-dev
   ```
4. Choose a temporary master password, and add a testnet wallet through the GUI so you can exercise key flows.

## Development workflow

- **Linting/formatting**: We use ESLint for code quality. Run `npm run lint` to check your code.
- **Code style**: Follow the existing React/JavaScript patterns. Keep imports organized and use descriptive variable names.
- **Testing**: Run `npm test` before sending a PR. Add tests for new features where feasible. For E2E tests, use `npm run e2e`.
- **UI tweaks**: Include screenshots or screen recordings in the PR description for any significant visual changes.
- **Secrets**: Never commit real seeds, private keys, or decrypted exports. The encrypted wallet data is stored in your system's app data directory.

## Available scripts

```bash
npm start              # Start React dev server only
npm run electron-dev   # Start full Electron app with hot reload
npm run build          # Build React app for production
npm run dist           # Create distributables for current platform
npm run lint           # Run ESLint
npm test               # Run unit tests
npm run e2e            # Run end-to-end tests
```

## Packaging checks

When your change affects packaging, validate at least one of the following platforms:

- **Current platform**: `npm run dist` (builds for your current OS)
- **All platforms** (macOS only): `npm run dist-all`
- **Linux packages**:
  ```bash
  npm run dist
  # Creates .AppImage, .deb, and .rpm in dist-electron/
  ```

Attach notes about which platform(s) you confirmed in the PR.

## Project structure

```
xrp-wallet-manager/
├── src/              # React components and utilities
│   ├── components/   # UI components
│   └── utils/        # Core utilities (encryption, XRPL, storage)
├── main.js           # Electron main process
├── preload.js        # Electron preload (secure IPC)
├── public/           # Static assets
├── assets/           # App icons
└── .github/          # CI/CD workflows
```

## Commit and PR guidelines

- Keep commits focused and well-described.
- Include a summary in the PR body explaining motivation, implementation, and testing.
- Reference related issues (e.g., `Fixes #123`) when applicable.
- Ensure CI checks pass (linting, tests, builds for all platforms).

## Code of conduct

Be respectful and inclusive. Harassment or discrimination of any kind is not tolerated. Please report unacceptable behavior to the repository owner or GitHub Support.
