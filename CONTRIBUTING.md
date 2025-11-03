# Contributing to XRP Wallet Manager

Thanks for your interest in improving XRP Wallet Manager! The guidelines below help us keep development smooth and consistent.

## Getting started

1. Fork the repository and create a feature branch from `main`.
2. Create a virtual environment and install dependencies:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
3. Launch `python run.py`, choose a temporary master password, and add a testnet wallet through the GUI so you can exercise key flows.

## Development workflow

- **Linting/formatting**: We follow standard Python conventions (PEP 8). Please keep imports tidy and prefer descriptive variable names. If you introduce a formatter or linter, document the command in this file.
- **Type hints**: New code should include type annotations where practical.
- **Testing**: At a minimum run `python -m py_compile gui.py xrp_wallet.py run.py` before sending a PR. Where feasible, add automated tests around new logic.
- **UI tweaks**: Include screenshots or screen recordings in the PR description for any significant visual changes.
- **Secrets**: Never commit real seeds or decrypted exports. The repo ignores `data/` and `.xrp_wallet_manager/` to keep encrypted wallets private.

## Packaging checks

When your change affects packaging, validate at least one of the following:

- **macOS**: `pyinstaller --windowed --name "XRP Wallet Manager" run.py`
- **Linux (native)**: `installers/linux/build.sh`
- **Linux (Docker)**: `installers/linux/run-build.sh` (requires Docker/Podman; Colima works on macOS)

Attach notes about which platform(s) you confirmed in the PR.

## Commit and PR guidelines

- Keep commits focused and well-described.
- Include a summary in the PR body explaining motivation, implementation, and testing.
- Reference related issues (e.g., `Fixes #123`) when applicable.

## Code of conduct

Be respectful and inclusive. Harassment or discrimination of any kind is not tolerated. Please report unacceptable behavior to the repository owner or GitHub Support.
