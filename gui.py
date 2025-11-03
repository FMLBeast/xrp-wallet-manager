"""
Modern XRP Wallet Manager GUI
Enhanced interface with multi-wallet support and beautiful styling
"""

import base64
import hashlib
import hmac
import json
import os
import secrets
import threading
import tkinter as tk
import webbrowser
from datetime import datetime
from pathlib import Path
from queue import Empty, Queue
from tkinter import filedialog, messagebox, scrolledtext, simpledialog, ttk
from typing import Dict, List, Optional

import requests

from xrp_wallet import SecretInfo, XRPWalletManager, create_wallet_from_secret


class ModernStyle:
    """Modern color scheme and styling constants"""

    # Color palette
    PRIMARY = "#2563eb"      # Blue
    PRIMARY_DARK = "#1d4ed8" # Dark blue
    SECONDARY = "#64748b"    # Slate
    SUCCESS = "#10b981"      # Green
    WARNING = "#f59e0b"      # Amber
    ERROR = "#ef4444"        # Red

    # Background colors
    BG_PRIMARY = "#ffffff"   # White
    BG_SECONDARY = "#f8fafc" # Light gray
    BG_TERTIARY = "#e2e8f0"  # Medium gray

    # Text colors
    TEXT_PRIMARY = "#1e293b"   # Dark slate
    TEXT_SECONDARY = "#64748b" # Medium slate
    TEXT_MUTED = "#94a3b8"     # Light slate

    # Fonts
    FONT_MAIN = ("SF Pro Display", 10)
    FONT_HEADING = ("SF Pro Display", 12, "bold")
    FONT_LARGE = ("SF Pro Display", 14, "bold")
    FONT_MONO = ("SF Mono", 9)


class WalletData:
    """Data class for wallet information"""

    def __init__(
        self,
        name: str,
        secret: str,
        network: str = "testnet",
        *,
        secret_type: str = "seed",
        public_key: str = "",
        algorithm: str = "ed25519",
    ):
        self.name = name
        self.secret = secret
        self.secret_type = secret_type
        self.public_key = public_key
        self.algorithm = algorithm
        self.network = network
        self.address = ""
        self.balance = "0"
        self.is_active = False

    def to_record(self) -> Dict[str, str]:
        """Serialize wallet data for persistence."""
        return {
            "name": self.name,
            "network": self.network,
            "address": self.address,
            "secret": self.secret,
            "secret_type": self.secret_type,
            "public_key": self.public_key,
            "algorithm": self.algorithm,
            "balance": self.balance,
        }


class MultiWalletManager:
    """Manager for multiple wallets with encrypted storage."""

    def __init__(self):
        self.wallets: Dict[str, WalletData] = {}
        self.secret_cache: Dict[str, SecretInfo] = {}
        self.active_wallet: Optional[str] = None
        self.wallet_managers: Dict[str, XRPWalletManager] = {}
        self.address_book: List[Dict[str, Optional[str]]] = []

        self.storage_dir = Path(__file__).resolve().parent / "data"
        self.storage_dir.mkdir(exist_ok=True)
        self.encrypted_file = self.storage_dir / "wallets.enc"
        self.legacy_file = self.storage_dir / "wallets.json"

        self.password: Optional[str] = None
        self.kdf_iterations = 390000
        self.initialized = False

    def has_encrypted_data(self) -> bool:
        """Return True if an encrypted wallet store already exists."""
        return self.encrypted_file.exists()

    def ensure_initialized(self):
        """Ensure the manager has been unlocked with a master password."""
        if not self.initialized or not self.password:
            raise RuntimeError(
                "Wallet manager not initialized with a master password."
            )

    def initialize(self, password: str):
        """Initialize storage with the provided master password."""
        password = (password or "").strip()
        if len(password) < 8:
            raise ValueError("Password must be at least 8 characters long.")

        if self.initialized:
            self.password = password
            return

        if self.encrypted_file.exists():
            self._load_encrypted_store(password)
        else:
            self.password = password
            self.initialized = True
            if self.legacy_file.exists():
                self._load_legacy_store()
            self.save_wallets()

    def _load_legacy_store(self):
        """Load legacy plaintext storage and re-encrypt it."""
        try:
            with open(self.legacy_file, "r", encoding="utf-8") as f:
                legacy_data = json.load(f)
            self._load_from_payload(legacy_data)
        except Exception as exc:
            print(f"Failed to load legacy wallets: {exc}")
        finally:
            try:
                self.legacy_file.unlink()
            except OSError:
                pass

    def _derive_keys(
        self, password: str, salt: bytes, iterations: int
    ) -> tuple[bytes, bytes]:
        """Derive encryption and authentication keys from the password."""
        derived = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt, iterations, dklen=64
        )
        return derived[:32], derived[32:]

    def _stream_cipher(self, key: bytes, nonce: bytes, data: bytes) -> bytes:
        """Encrypt/decrypt data using an HMAC-SHA256-based stream cipher."""
        block_size = hashlib.sha256().digest_size
        output = bytearray()
        counter = 0

        while len(output) < len(data):
            counter_bytes = counter.to_bytes(8, "big")
            keystream = hmac.new(key, nonce + counter_bytes, hashlib.sha256).digest()
            chunk = data[len(output) : len(output) + block_size]
            output.extend(bytes(a ^ b for a, b in zip(chunk, keystream)))
            counter += 1

        return bytes(output)

    def _encrypt_payload(self, payload: Dict[str, Dict]) -> Dict[str, object]:
        """Encrypt payload into a JSON-friendly envelope."""
        self.ensure_initialized()
        salt = secrets.token_bytes(16)
        nonce = secrets.token_bytes(16)
        enc_key, mac_key = self._derive_keys(self.password, salt, self.kdf_iterations)

        plaintext = json.dumps(payload).encode("utf-8")
        ciphertext = self._stream_cipher(enc_key, nonce, plaintext)
        mac = hmac.new(mac_key, nonce + ciphertext, hashlib.sha256).digest()

        return {
            "version": 1,
            "salt": base64.b64encode(salt).decode("utf-8"),
            "kdf": {
                "name": "pbkdf2_sha256",
                "iterations": self.kdf_iterations,
            },
            "nonce": base64.b64encode(nonce).decode("utf-8"),
            "mac": base64.b64encode(mac).decode("utf-8"),
            "ciphertext": base64.b64encode(ciphertext).decode("utf-8"),
        }

    def _load_encrypted_store(self, password: str):
        """Load wallets from encrypted storage using the provided password."""
        try:
            with open(self.encrypted_file, "r", encoding="utf-8") as f:
                envelope = json.load(f)
        except Exception as exc:
            raise ValueError(f"Unable to read wallet storage: {exc}") from exc

        try:
            salt = base64.b64decode(envelope["salt"])
            iterations = envelope.get("kdf", {}).get("iterations", self.kdf_iterations)
            nonce = base64.b64decode(envelope["nonce"])
            ciphertext = base64.b64decode(envelope["ciphertext"])
            mac = base64.b64decode(envelope["mac"])
        except KeyError as exc:
            raise ValueError("Wallet storage file is corrupted.") from exc

        enc_key, mac_key = self._derive_keys(password, salt, iterations)
        expected_mac = hmac.new(mac_key, nonce + ciphertext, hashlib.sha256).digest()

        if not hmac.compare_digest(mac, expected_mac):
            raise ValueError("Incorrect password or corrupted wallet storage.")

        plaintext = self._stream_cipher(enc_key, nonce, ciphertext)

        payload = json.loads(plaintext.decode("utf-8"))
        self.password = password
        self.kdf_iterations = iterations
        self.initialized = True
        self._load_from_payload(payload)

    def _load_from_payload(self, payload: Dict[str, Dict]):
        """Populate in-memory wallet state from decrypted payload."""
        self.wallets.clear()
        self.secret_cache.clear()
        self.wallet_managers.clear()

        wallets_data = payload.get("wallets", {})
        for name, record in wallets_data.items():
            secret = record.get("secret")
            if not secret:
                continue

            network = record.get("network", "testnet")
            public_key = record.get("public_key") or None
            algorithm = record.get("algorithm") or None

            try:
                wallet, secret_info = create_wallet_from_secret(
                    secret,
                    public_key=public_key,
                    algorithm_hint=algorithm,
                )
            except Exception as exc:
                print(f"Skipping wallet '{name}': {exc}")
                continue

            wallet_data = WalletData(
                name,
                secret_info.secret,
                network,
                secret_type=record.get("secret_type", secret_info.secret_type),
                public_key=secret_info.public_key,
                algorithm=secret_info.algorithm.value,
            )
            wallet_data.address = record.get("address", wallet.address)
            wallet_data.balance = record.get("balance", wallet_data.balance)

            self.wallets[name] = wallet_data
            self.secret_cache[name] = secret_info

            manager = XRPWalletManager(network=network, auto_load_env=False)
            manager.use_wallet(wallet, secret_info)
            self.wallet_managers[name] = manager

        self.active_wallet = payload.get("active_wallet")
        for data in self.wallets.values():
            data.is_active = False

        if self.active_wallet in self.wallets:
            active = self.wallets[self.active_wallet]
            active.is_active = True
            os.environ["WALLET_SECRET"] = active.secret
            os.environ["NETWORK"] = active.network
        else:
            self.active_wallet = None

        self.address_book = payload.get("address_book", [])

    def add_wallet(
        self,
        name: str,
        secret: str,
        network: str = "testnet",
        secret_info: Optional[SecretInfo] = None,
    ) -> bool:
        """Add a new wallet."""
        self.ensure_initialized()
        try:
            info = secret_info
            if info is None:
                wallet, info = create_wallet_from_secret(secret)
            else:
                wallet = info.make_wallet()

            if wallet is None or info is None:
                raise ValueError("Unable to construct wallet from provided secret")

            manager = XRPWalletManager(network=network, auto_load_env=False)
            manager.use_wallet(wallet, info)
            manager.network = network
            manager.setup_client()

            wallet_data = WalletData(
                name,
                info.secret,
                network,
                secret_type=info.secret_type,
                public_key=info.public_key,
                algorithm=info.algorithm.value,
            )
            wallet_data.address = wallet.address

            self.wallets[name] = wallet_data
            self.wallet_managers[name] = manager
            self.secret_cache[name] = info

            self.save_wallets()
            return True

        except Exception as exc:
            print(f"Error adding wallet '{name}': {exc}")
            import traceback

            traceback.print_exc()
            return False

    def remove_wallet(self, name: str) -> bool:
        """Remove a wallet."""
        self.ensure_initialized()
        if name in self.wallets:
            if self.active_wallet == name:
                self.active_wallet = None

            self.secret_cache.pop(name, None)
            self.wallet_managers.pop(name, None)
            del self.wallets[name]

            self.save_wallets()
            return True
        return False

    def set_active_wallet(self, name: str) -> bool:
        """Set the active wallet."""
        self.ensure_initialized()
        if name not in self.wallets:
            return False

        self.active_wallet = name
        for data in self.wallets.values():
            data.is_active = False

        wallet_data = self.wallets[name]
        wallet_data.is_active = True

        manager = self.get_or_create_manager(name)
        if not manager:
            return False

        os.environ["WALLET_SECRET"] = wallet_data.secret
        os.environ["NETWORK"] = wallet_data.network

        self.save_wallets()
        return True

    def get_active_manager(self) -> Optional[XRPWalletManager]:
        """Get the wallet manager for the active wallet."""
        if self.active_wallet and self.active_wallet in self.wallet_managers:
            return self.wallet_managers[self.active_wallet]
        return None

    def get_or_create_manager(self, name: str) -> Optional[XRPWalletManager]:
        """Return a manager for the specified wallet without changing active selection."""
        self.ensure_initialized()
        if name not in self.wallets:
            return None

        wallet_data = self.wallets[name]
        secret_info = self.secret_cache.get(name)
        if not secret_info:
            wallet, secret_info = create_wallet_from_secret(
                wallet_data.secret,
                public_key=wallet_data.public_key,
                algorithm_hint=wallet_data.algorithm,
            )
            self.secret_cache[name] = secret_info
        else:
            wallet = secret_info.make_wallet()

        manager = self.wallet_managers.get(name)
        if manager is None:
            manager = XRPWalletManager(network=wallet_data.network, auto_load_env=False)
            self.wallet_managers[name] = manager

        manager.network = wallet_data.network
        manager.setup_client()
        manager.use_wallet(wallet, secret_info)
        return manager

    def get_active_wallet(self) -> Optional[WalletData]:
        """Get the active wallet data."""
        if self.active_wallet and self.active_wallet in self.wallets:
            return self.wallets[self.active_wallet]
        return None

    def save_wallets(self):
        """Persist wallet configurations securely."""
        self.ensure_initialized()

        wallet_configs: Dict[str, Dict[str, str]] = {}
        for name, wallet in self.wallets.items():
            secret_info = self.secret_cache.get(name)
            if not secret_info:
                _, secret_info = create_wallet_from_secret(
                    wallet.secret,
                    public_key=wallet.public_key,
                    algorithm_hint=wallet.algorithm,
                )
                self.secret_cache[name] = secret_info

            record = wallet.to_record()
            record["public_key"] = secret_info.public_key
            record["algorithm"] = secret_info.algorithm.value
            wallet_configs[name] = record

        payload = {
            "wallets": wallet_configs,
            "active_wallet": self.active_wallet,
            "address_book": self.address_book,
        }
        envelope = self._encrypt_payload(payload)

        self.storage_dir.mkdir(exist_ok=True)
        with open(self.encrypted_file, "w", encoding="utf-8") as f:
            json.dump(envelope, f, indent=2)

        if self.legacy_file.exists():
            try:
                self.legacy_file.unlink()
            except OSError:
                pass

    def get_address_book(self) -> List[Dict[str, Optional[str]]]:
        return list(self.address_book)

    def add_or_update_contact(
        self,
        label: str,
        address: str,
        destination_tag: Optional[str],
        index: Optional[int] = None,
    ):
        entry = {
            "label": label.strip(),
            "address": address.strip(),
            "destination_tag": destination_tag.strip() if destination_tag else "",
        }
        if index is not None and 0 <= index < len(self.address_book):
            self.address_book[index] = entry
        else:
            self.address_book.append(entry)
        self.save_wallets()

    def remove_contact(self, index: int):
        if 0 <= index < len(self.address_book):
            del self.address_book[index]
            self.save_wallets()



class ModernXRPWalletGUI:
    """Modern XRP Wallet Manager GUI with multi-wallet support"""

    def __init__(self, root):
        self.root = root
        self.ui_queue: Queue = Queue()
        self.multi_wallet = MultiWalletManager()
        self.wallet_balance_labels: Dict[str, tk.StringVar] = {}
        self.receive_qr_cache: Dict[str, tk.PhotoImage] = {}
        self.receive_qr_image = None
        self.receive_last_address: Optional[str] = None
        self.multisig_session: Optional[Dict] = None
        self.multisig_signer_entries: List[Dict] = []
        self.multisig_status: Dict[str, object] = {'enabled': False}

        self.setup_modern_gui()
        self.root.after(50, self._process_ui_queue)
        self.setup_welcome_screen()

        if not self.prompt_for_master_password():
            self.root.after(0, self.root.destroy)
            return

        self.refresh_wallet_list()
        self.update_network_status()
        self.root.focus_force()

    def prompt_for_master_password(self) -> bool:
        """Prompt the user to unlock or create the master password."""
        has_store = self.multi_wallet.has_encrypted_data()

        if has_store:
            attempts_remaining = 5
            while attempts_remaining > 0:
                password = self.show_password_dialog(
                    "Unlock Wallets",
                    "Enter your master password:",
                )
                if password is None:
                    if messagebox.askyesno(
                        "Exit",
                        "Unlocking is required to continue.\nDo you want to exit?",
                        parent=self.root,
                    ):
                        return False
                    continue

                try:
                    self.multi_wallet.initialize(password)
                    return True
                except ValueError as exc:
                    attempts_remaining -= 1
                    messagebox.showerror(
                        "Incorrect Password",
                        f"{exc}\nAttempts remaining: {attempts_remaining}",
                        parent=self.root,
                    )

            messagebox.showerror(
                "Access Denied",
                "Too many failed attempts. The application will close.",
                parent=self.root,
            )
            return False

        # No encrypted store yet - enforce password creation
        while True:
            password = self.show_password_dialog(
                "Create Master Password",
                "Create a master password (minimum 8 characters):",
                require_confirmation=True,
            )
            if password is None:
                if messagebox.askyesno(
                    "Exit",
                    "A master password is required. Exit the application?",
                    parent=self.root,
                ):
                    return False
                else:
                    continue

            if len(password.strip()) < 8:
                messagebox.showerror(
                    "Weak Password",
                    "Password must be at least 8 characters long.",
                    parent=self.root,
                )
                continue

            try:
                self.multi_wallet.initialize(password)
                messagebox.showinfo(
                    "Master Password Set",
                    "Master password created successfully. Keep it safe!",
                    parent=self.root,
                )
                return True
            except ValueError as exc:
                messagebox.showerror("Password Error", str(exc), parent=self.root)

    def show_password_dialog(self, title: str, prompt: str, require_confirmation: bool = False) -> Optional[str]:
        dialog = PasswordDialog(self.root, title, prompt, require_confirmation)
        self.root.wait_window(dialog.dialog)
        return dialog.result

    def setup_modern_gui(self):
        """Initialize the modern GUI with styling"""
        self.root.title("XRP Wallet Manager")
        self.root.geometry("1200x800")
        self.root.minsize(1000, 600)
        self.root.configure(bg=ModernStyle.BG_PRIMARY)

        # Configure modern ttk styles
        self.setup_styles()

        # Create main container
        self.main_container = ttk.Frame(self.root, style="Main.TFrame")
        self.main_container.pack(fill="both", expand=True, padx=20, pady=20)

    def setup_styles(self):
        """Configure modern ttk styles"""
        style = ttk.Style()

        # Use a theme that gives us better control
        try:
            style.theme_use('clam')  # More customizable than default
        except:
            pass

        # Configure main frame style
        style.configure("Main.TFrame", background=ModernStyle.BG_PRIMARY)

        # Configure modern button styles with high contrast
        style.configure("Primary.TButton",
                       background=ModernStyle.PRIMARY,
                       foreground="white",
                       font=ModernStyle.FONT_MAIN,
                       padding=(20, 10),
                       relief="flat",
                       borderwidth=0)

        style.map("Primary.TButton",
                 background=[("active", ModernStyle.PRIMARY_DARK),
                           ("pressed", ModernStyle.PRIMARY_DARK),
                           ("focus", ModernStyle.PRIMARY)],
                 foreground=[("active", "white"),
                           ("pressed", "white"),
                           ("focus", "white"),
                           ("!focus", "white")])

        # Success button
        style.configure("Success.TButton",
                       background=ModernStyle.SUCCESS,
                       foreground="white",
                       font=ModernStyle.FONT_MAIN,
                       padding=(15, 8),
                       relief="flat",
                       borderwidth=0)

        style.map("Success.TButton",
                 background=[("active", "#059669"),
                           ("pressed", "#047857"),
                           ("focus", ModernStyle.SUCCESS)],
                 foreground=[("active", "white"),
                           ("pressed", "white"),
                           ("focus", "white"),
                           ("!focus", "white")])

        # Warning button
        style.configure("Warning.TButton",
                       background=ModernStyle.WARNING,
                       foreground="white",
                       font=ModernStyle.FONT_MAIN,
                       padding=(15, 8),
                       relief="flat",
                       borderwidth=0)

        style.map("Warning.TButton",
                 background=[("active", "#d97706"),
                           ("pressed", "#b45309"),
                           ("focus", ModernStyle.WARNING)],
                 foreground=[("active", "white"),
                           ("pressed", "white"),
                           ("focus", "white"),
                           ("!focus", "white")])

        # Default button style (for buttons without specific style) - dark text on light background
        style.configure("TButton",
                       background="#e5e7eb",
                       foreground="#111827",
                       font=ModernStyle.FONT_MAIN,
                       padding=(15, 8),
                       relief="flat",
                       borderwidth=1)

        style.map("TButton",
                 background=[("active", "#d1d5db"),
                           ("pressed", "#9ca3af"),
                           ("focus", "#e5e7eb")],
                 foreground=[("active", "#111827"),
                           ("pressed", "#111827"),
                           ("focus", "#111827"),
                           ("!focus", "#111827")])

        # Modern frame styles
        style.configure("Card.TFrame",
                       background=ModernStyle.BG_PRIMARY,
                       relief="solid",
                       borderwidth=1)

        # Modern label styles
        style.configure("Heading.TLabel",
                       font=ModernStyle.FONT_HEADING,
                       foreground=ModernStyle.TEXT_PRIMARY,
                       background=ModernStyle.BG_PRIMARY)

        style.configure("Large.TLabel",
                       font=ModernStyle.FONT_LARGE,
                       foreground=ModernStyle.TEXT_PRIMARY,
                       background=ModernStyle.BG_PRIMARY)

        style.configure("Muted.TLabel",
                       font=ModernStyle.FONT_MAIN,
                       foreground=ModernStyle.TEXT_MUTED,
                       background=ModernStyle.BG_PRIMARY)

    def setup_welcome_screen(self):
        """Setup the welcome/wallet selection screen"""
        # Clear main container
        for widget in self.main_container.winfo_children():
            widget.destroy()

        # Welcome header
        header_frame = ttk.Frame(self.main_container, style="Main.TFrame")
        header_frame.pack(fill="x", pady=(0, 30))

        ttk.Label(header_frame, text="XRP Wallet Manager",
                 style="Large.TLabel").pack()
        ttk.Label(header_frame, text="Manage multiple XRP wallets with ease",
                 style="Muted.TLabel").pack(pady=(5, 0))

        # Main content area
        content_frame = ttk.Frame(self.main_container, style="Main.TFrame")
        content_frame.pack(fill="both", expand=True)

        # Left panel - Wallet list
        left_panel = self.create_card_frame(content_frame)
        left_panel.pack(side="left", fill="both", expand=True, padx=(0, 10))

        ttk.Label(left_panel, text="Your Wallets",
                 style="Heading.TLabel").pack(anchor="w", pady=(0, 15))

        # Wallet list
        self.wallet_list_frame = ttk.Frame(left_panel, style="Main.TFrame")
        self.wallet_list_frame.pack(fill="both", expand=True)

        self.refresh_wallet_list()

        # Right panel - Actions
        right_panel = self.create_card_frame(content_frame)
        right_panel.pack(side="right", fill="y", padx=(10, 0))
        right_panel.configure(width=300)

        ttk.Label(right_panel, text="Actions",
                 style="Heading.TLabel").pack(anchor="w", pady=(0, 15))

        # Action buttons
        ttk.Button(right_panel, text="➕ Add New Wallet",
                  command=self.add_wallet_dialog,
                  style="Primary.TButton").pack(fill="x", pady=(0, 10))

        ttk.Button(right_panel, text="🔑 Import Private Key",
                  command=self.import_private_key_dialog,
                  style="Success.TButton").pack(fill="x", pady=(0, 10))

        ttk.Button(right_panel, text="🧪 Generate Test Wallet",
                  command=self.generate_test_wallet_dialog,
                  style="Warning.TButton").pack(fill="x", pady=(0, 20))

        # Network status
        ttk.Label(right_panel, text="Network Status",
                 style="Heading.TLabel").pack(anchor="w", pady=(20, 10))

        self.network_status_text = tk.Text(right_panel, height=8, width=30,
                                         font=ModernStyle.FONT_MONO,
                                         bg=ModernStyle.BG_SECONDARY,
                                         fg=ModernStyle.TEXT_SECONDARY,
                                         relief="flat", state="disabled")
        self.network_status_text.pack(fill="x")

        # Status bar
        self.setup_status_bar()

        # Load network info
        self.update_network_status()

    def create_card_frame(self, parent) -> ttk.Frame:
        """Create a modern card-style frame"""
        card = ttk.Frame(parent, style="Card.TFrame", padding=20)
        return card

    def create_wallet_card(self, parent, wallet_data: WalletData) -> ttk.Frame:
        """Create a wallet card widget"""
        card = ttk.Frame(parent, style="Card.TFrame", padding=15)

        # Header with name and network
        header_frame = ttk.Frame(card, style="Main.TFrame")
        header_frame.pack(fill="x", pady=(0, 10))

        ttk.Label(header_frame, text=wallet_data.name,
                 style="Heading.TLabel").pack(side="left")

        network_color = ModernStyle.SUCCESS if wallet_data.network == "mainnet" else ModernStyle.WARNING
        network_label = ttk.Label(header_frame, text=wallet_data.network.upper(),
                                style="Muted.TLabel")
        network_label.pack(side="right")

        # Address
        address_frame = ttk.Frame(card, style="Main.TFrame")
        address_frame.pack(fill="x", pady=(0, 5))

        ttk.Label(address_frame, text="Address:", style="Muted.TLabel").pack(side="left")
        address_text = wallet_data.address[:20] + "..." if len(wallet_data.address) > 20 else wallet_data.address
        ttk.Label(address_frame, text=address_text,
                 font=ModernStyle.FONT_MONO).pack(side="right")

        # Balance
        balance_frame = ttk.Frame(card, style="Main.TFrame")
        balance_frame.pack(fill="x", pady=(0, 15))

        ttk.Label(balance_frame, text="Balance:", style="Muted.TLabel").pack(side="left")
        balance_value = (
            f"{wallet_data.balance} XRP" if wallet_data.balance not in ("", "Error") else wallet_data.balance or "Loading..."
        )
        balance_var = tk.StringVar(value=balance_value)
        balance_label = ttk.Label(
            balance_frame, textvariable=balance_var, style="Heading.TLabel"
        )
        balance_label.pack(side="right")
        self.wallet_balance_labels[wallet_data.name] = balance_var

        # Actions
        actions_frame = ttk.Frame(card, style="Main.TFrame")
        actions_frame.pack(fill="x")

        ttk.Button(actions_frame, text="Select",
                  command=lambda: self.select_wallet(wallet_data.name),
                  style="Primary.TButton").pack(side="left", padx=(0, 5))

        ttk.Button(actions_frame, text="Remove",
                  command=lambda: self.remove_wallet(wallet_data.name)).pack(side="left")

        return card

    def refresh_wallet_list(self):
        """Refresh the wallet list display"""
        # Clear existing widgets
        for widget in self.wallet_list_frame.winfo_children():
            widget.destroy()
        self.wallet_balance_labels.clear()

        if not self.multi_wallet.wallets:
            # Show empty state
            empty_frame = ttk.Frame(self.wallet_list_frame, style="Main.TFrame")
            empty_frame.pack(fill="both", expand=True)

            ttk.Label(empty_frame, text="No wallets added yet",
                     style="Muted.TLabel").pack(anchor="center", pady=50)
            ttk.Label(empty_frame, text="Add a wallet to get started",
                     style="Muted.TLabel").pack(anchor="center")
        else:
            # Show wallet cards
            for name, wallet_data in self.multi_wallet.wallets.items():
                card = self.create_wallet_card(self.wallet_list_frame, wallet_data)
                card.pack(fill="x", pady=(0, 10))

        self.update_wallet_balances()

    def add_wallet_dialog(self):
        """Show dialog to add a new wallet"""
        dialog = WalletDialog(self.root, "Add New Wallet")
        if dialog.result:
            name, secret_input, network = dialog.result

            try:
                _, secret_info = create_wallet_from_secret(secret_input)
            except ValueError as exc:
                messagebox.showerror("Invalid Secret", str(exc))
                return

            try:
                if self.multi_wallet.add_wallet(
                    name, secret_info.secret, network, secret_info=secret_info
                ):
                    messagebox.showinfo(
                        "Success", f"Wallet '{name}' added successfully!"
                    )
                    self.refresh_wallet_list()
                    self.update_status(f"Added wallet: {name}")
                    self.update_wallet_balances()
                else:
                    messagebox.showerror(
                        "Error", "Failed to add wallet. Please check the secret."
                    )
            except Exception as exc:
                messagebox.showerror("Add Wallet Error", f"Failed to add wallet:\n{exc}")

    def import_private_key_dialog(self):
        """Show dialog to import a private key or seed"""
        # Get private key or seed
        secret_input = simpledialog.askstring(
            "Import Private Key or Seed",
            "Enter your private key (64 hex) or seed (s...):",
            show="*",
        )
        if not secret_input:
            return

        try:
            _, secret_info = create_wallet_from_secret(secret_input)
        except ValueError as exc:
            messagebox.showerror("Invalid Secret", str(exc))
            return

        # Get wallet name
        name = simpledialog.askstring("Wallet Name", "Enter a name for this wallet:")
        if not name:
            return

        # Get network
        network = messagebox.askyesno(
            "Network Selection", "Use mainnet? (No = testnet)"
        )
        network = "mainnet" if network else "testnet"

        try:
            if self.multi_wallet.add_wallet(
                name, secret_info.secret, network, secret_info=secret_info
            ):
                messagebox.showinfo("Success", f"Wallet imported as '{name}'!")
                self.refresh_wallet_list()
                self.update_status(f"Imported wallet: {name}")
                self.update_wallet_balances()
            else:
                messagebox.showerror(
                    "Error", "Failed to import wallet. Please check the secret format."
                )
        except Exception as exc:
            messagebox.showerror("Import Error", f"Failed to import wallet:\n{exc}")

    def generate_test_wallet_dialog(self):
        """Generate a test wallet"""
        self.update_status("Generating test wallet...")

        def generate_thread():
            try:
                # Create temporary manager for testnet
                temp_manager = XRPWalletManager(network="testnet", auto_load_env=False)
                wallet, secret_info = temp_manager.generate_test_wallet()
                address = wallet.address

                def ask_name():
                    name = simpledialog.askstring(
                        "Test Wallet Name",
                        "Enter a name for this test wallet:",
                        initialvalue=f"Test-{address[:8]}",
                    )
                    if not name:
                        self.update_status("Test wallet creation cancelled")
                        return

                    if self.multi_wallet.add_wallet(
                        name, secret_info.secret, "testnet", secret_info=secret_info
                    ):
                        messagebox.showinfo(
                            "Success",
                            (
                                f"Test wallet '{name}' created successfully!\n\n"
                                f"Address: {address}\n"
                                "Network: Testnet\n\n"
                                "The wallet has been funded with test XRP.\n\n"
                                f"Seed (copy + store securely):\n{secret_info.secret}\n\n"
                                "This secret is also stored encrypted in data/wallets.enc."
                            ),
                        )
                        self.refresh_wallet_list()
                        self.update_status("Test wallet generated successfully")
                    else:
                        messagebox.showerror(
                            "Error", "Failed to add generated test wallet"
                        )
                        self.update_status("Failed to add generated test wallet")

                self.run_on_ui_thread(ask_name)

            except Exception as e:
                error_msg = f"Error generating test wallet: {e}"

                def show_error():
                    self.update_status(error_msg)
                    messagebox.showerror("Test Wallet Error", error_msg)

                self.run_on_ui_thread(show_error)

        threading.Thread(target=generate_thread, daemon=True).start()

    def select_wallet(self, name: str):
        """Select and open a wallet"""
        if self.multi_wallet.set_active_wallet(name):
            self.update_status(f"Selected wallet: {name}")
            self.open_wallet_interface()
        else:
            messagebox.showerror("Error", "Failed to select wallet")

    def remove_wallet(self, name: str):
        """Remove a wallet"""
        if messagebox.askyesno("Confirm Removal",
                             f"Are you sure you want to remove wallet '{name}'?\n\n"
                             "This will only remove it from the app, not delete the actual wallet."):
            if self.multi_wallet.remove_wallet(name):
                self.refresh_wallet_list()
                self.update_status(f"Removed wallet: {name}")
                self.update_wallet_balances()

    def open_wallet_interface(self):
        """Open the main wallet interface"""
        # Clear and create the main wallet interface
        for widget in self.main_container.winfo_children():
            widget.destroy()

        # Create the main wallet interface (similar to original but with multi-wallet support)
        self.create_main_wallet_interface()

    def create_main_wallet_interface(self):
        """Create the main wallet management interface"""
        # Header with wallet selector
        header_frame = ttk.Frame(self.main_container, style="Main.TFrame")
        header_frame.pack(fill="x", pady=(0, 20))

        # Back button
        ttk.Button(header_frame, text="← Back to Wallets",
                  command=self.setup_welcome_screen).pack(side="left")

        # Active wallet info
        active_wallet = self.multi_wallet.get_active_wallet()
        if active_wallet:
            wallet_info = ttk.Label(header_frame,
                                  text=f"Active: {active_wallet.name} ({active_wallet.network})",
                                  style="Heading.TLabel")
            wallet_info.pack(side="right")

        # Create notebook for tabs
        self.notebook = ttk.Notebook(self.main_container)
        self.notebook.pack(fill="both", expand=True)

        # Create tabs
        self.create_wallet_tab()
        self.create_send_tab()
        self.create_receive_tab()
        self.create_history_tab()
        self.create_multisig_tab()

        # Refresh wallet info
        self.refresh_wallet_info()

    def create_wallet_tab(self):
        """Create wallet overview tab"""
        self.wallet_frame = ttk.Frame(self.notebook, style="Main.TFrame")
        self.notebook.add(self.wallet_frame, text="  💼 Wallet  ")

        # Wallet info card
        info_card = self.create_card_frame(self.wallet_frame)
        info_card.pack(fill="x", pady=(0, 20))

        ttk.Label(info_card, text="Wallet Information",
                 style="Heading.TLabel").pack(anchor="w", pady=(0, 15))

        # Info grid
        info_grid = ttk.Frame(info_card, style="Main.TFrame")
        info_grid.pack(fill="x")

        # Address
        ttk.Label(info_grid, text="Address:", style="Muted.TLabel").grid(row=0, column=0, sticky="w", pady=5)
        self.address_var = tk.StringVar()
        address_entry = ttk.Entry(info_grid, textvariable=self.address_var, state="readonly",
                                width=50, font=ModernStyle.FONT_MONO)
        address_entry.grid(row=0, column=1, sticky="ew", padx=(10, 0), pady=5)

        # Balance
        ttk.Label(info_grid, text="Balance:", style="Muted.TLabel").grid(row=1, column=0, sticky="w", pady=5)
        self.balance_var = tk.StringVar()
        balance_label = ttk.Label(info_grid, textvariable=self.balance_var, style="Heading.TLabel")
        balance_label.grid(row=1, column=1, sticky="w", padx=(10, 0), pady=5)

        info_grid.columnconfigure(1, weight=1)

        # Action buttons
        actions_frame = ttk.Frame(info_card, style="Main.TFrame")
        actions_frame.pack(fill="x", pady=(15, 0))

        ttk.Button(actions_frame, text="🔄 Refresh",
                  command=self.refresh_wallet_info,
                  style="Primary.TButton").pack(side="left", padx=(0, 10))

        ttk.Button(actions_frame, text="📋 Copy Address",
                  command=self.copy_address,
                  style="Success.TButton").pack(side="left")

        ttk.Button(actions_frame, text="🌐 View in Explorer",
                  command=self.open_in_explorer).pack(side="left", padx=(10, 0))

        # Network info card
        network_card = self.create_card_frame(self.wallet_frame)
        network_card.pack(fill="both", expand=True)

        ttk.Label(network_card, text="Network Information",
                 style="Heading.TLabel").pack(anchor="w", pady=(0, 10))

        self.network_text = scrolledtext.ScrolledText(network_card, height=12,
                                                    font=ModernStyle.FONT_MONO,
                                                    bg=ModernStyle.BG_SECONDARY,
                                                    fg=ModernStyle.TEXT_SECONDARY,
                                                    state="disabled")
        self.network_text.pack(fill="both", expand=True)

    def create_send_tab(self):
        """Create send transaction tab"""
        self.send_frame = ttk.Frame(self.notebook, style="Main.TFrame")
        self.notebook.add(self.send_frame, text="  💸 Send  ")

        # Send form card
        form_card = self.create_card_frame(self.send_frame)
        form_card.pack(fill="x", pady=(0, 20))

        ttk.Label(form_card, text="Send XRP", style="Heading.TLabel").pack(anchor="w", pady=(0, 15))

        self.send_balance_var = tk.StringVar(value="Available: --")
        ttk.Label(
            form_card,
            textvariable=self.send_balance_var,
            style="Muted.TLabel",
        ).pack(anchor="w", pady=(0, 10))

        address_book_row = ttk.Frame(form_card, style="Main.TFrame")
        address_book_row.pack(fill="x", pady=(0, 10))
        ttk.Button(address_book_row, text="📚 Address Book", command=self.open_address_book,
                  style="TButton").pack(side="left")

        # Form grid
        form_grid = ttk.Frame(form_card, style="Main.TFrame")
        form_grid.pack(fill="x")

        # Destination
        ttk.Label(form_grid, text="Destination Address:", style="Muted.TLabel").grid(row=0, column=0, sticky="w", pady=10)
        self.dest_var = tk.StringVar()
        dest_entry = ttk.Entry(form_grid, textvariable=self.dest_var, width=50, font=ModernStyle.FONT_MONO)
        dest_entry.grid(row=0, column=1, sticky="ew", padx=(10, 0), pady=10)

        # Amount
        ttk.Label(form_grid, text="Amount (XRP):", style="Muted.TLabel").grid(row=1, column=0, sticky="w", pady=10)
        self.amount_var = tk.StringVar()
        amount_entry = ttk.Entry(form_grid, textvariable=self.amount_var, width=20)
        amount_entry.grid(row=1, column=1, sticky="w", padx=(10, 0), pady=10)

        # Destination tag
        ttk.Label(form_grid, text="Destination Tag (optional):", style="Muted.TLabel").grid(row=2, column=0, sticky="w", pady=10)
        self.dest_tag_var = tk.StringVar()
        dest_tag_entry = ttk.Entry(form_grid, textvariable=self.dest_tag_var, width=20)
        dest_tag_entry.grid(row=2, column=1, sticky="w", padx=(10, 0), pady=10)

        # Memo
        ttk.Label(form_grid, text="Memo (optional):", style="Muted.TLabel").grid(row=3, column=0, sticky="w", pady=10)
        self.memo_var = tk.StringVar()
        memo_entry = ttk.Entry(form_grid, textvariable=self.memo_var, width=50)
        memo_entry.grid(row=3, column=1, sticky="ew", padx=(10, 0), pady=10)

        form_grid.columnconfigure(1, weight=1)

        # Send button
        ttk.Button(form_card, text="💸 Send Transaction",
                  command=self.send_transaction,
                  style="Primary.TButton").pack(pady=(20, 0))

        # Result card
        result_card = self.create_card_frame(self.send_frame)
        result_card.pack(fill="both", expand=True)

        ttk.Label(result_card, text="Transaction Result",
                 style="Heading.TLabel").pack(anchor="w", pady=(0, 10))

        self.result_text = scrolledtext.ScrolledText(result_card, height=12,
                                                   font=ModernStyle.FONT_MONO,
                                                   bg=ModernStyle.BG_SECONDARY,
                                                   fg=ModernStyle.TEXT_SECONDARY,
                                                   state="disabled")
        self.result_text.pack(fill="both", expand=True)

    def create_receive_tab(self):
        """Create receive tab with QR code"""
        self.receive_frame = ttk.Frame(self.notebook, style="Main.TFrame")
        self.notebook.add(self.receive_frame, text="  📥 Receive  ")

        card = self.create_card_frame(self.receive_frame)
        card.pack(fill="both", expand=True)

        ttk.Label(card, text="Receive XRP", style="Heading.TLabel").pack(anchor="w", pady=(0, 15))

        self.receive_address_var = tk.StringVar(value="Select a wallet to view address")
        address_entry = ttk.Entry(card, textvariable=self.receive_address_var, state="readonly",
                                  font=ModernStyle.FONT_MONO)
        address_entry.pack(fill="x", pady=(0, 10))

        button_row = ttk.Frame(card, style="Main.TFrame")
        button_row.pack(fill="x", pady=(0, 10))

        ttk.Button(button_row, text="📋 Copy Address", command=self.copy_receive_address,
                  style="Success.TButton").pack(side="left")
        ttk.Button(button_row, text="🔄 Refresh QR", command=self.refresh_receive_qr,
                  style="Primary.TButton").pack(side="left", padx=(10, 0))
        ttk.Button(button_row, text="🌐 View in Explorer", command=self.open_in_explorer).pack(side="left", padx=(10, 0))

        self.receive_qr_label = ttk.Label(card, anchor="center", text="QR code will appear here")
        self.receive_qr_label.pack(pady=20)

        self.receive_status_var = tk.StringVar(value="")
        ttk.Label(card, textvariable=self.receive_status_var, style="Muted.TLabel").pack(anchor="center")

    def create_history_tab(self):
        """Create transaction history tab"""
        self.history_frame = ttk.Frame(self.notebook, style="Main.TFrame")
        self.notebook.add(self.history_frame, text="  📊 History  ")

        toolbar = ttk.Frame(self.history_frame, style="Main.TFrame")
        toolbar.pack(fill="x", pady=(0, 10))

        ttk.Button(toolbar, text="🔄 Refresh", command=self.refresh_history,
                  style="Primary.TButton").pack(side="left")

        self.history_status_var = tk.StringVar(value="")
        ttk.Label(toolbar, textvariable=self.history_status_var,
                 style="Muted.TLabel").pack(side="left", padx=(15, 0))

        filter_frame = ttk.Frame(self.history_frame, style="Main.TFrame")
        filter_frame.pack(fill="x", pady=(0, 10))

        ttk.Label(filter_frame, text="Limit:", style="Muted.TLabel").pack(side="left")
        self.limit_var = tk.StringVar(value="20")
        ttk.Combobox(filter_frame, textvariable=self.limit_var,
                     values=["10", "20", "50", "100"], width=10).pack(side="left", padx=(5, 20))

        ttk.Button(filter_frame, text="Copy Hash",
                  command=self.copy_selected_hash).pack(side="left")
        ttk.Button(filter_frame, text="Open in Explorer",
                  command=self.open_selected_in_explorer).pack(side="left", padx=(10, 0))

        body = ttk.Frame(self.history_frame, style="Main.TFrame")
        body.pack(fill="both", expand=True)

        # Summary card
        summary_card = self.create_card_frame(body)
        summary_card.pack(side="top", fill="x", pady=(0, 10))
        ttk.Label(summary_card, text="Summary (24h)", style="Heading.TLabel").pack(anchor="w")
        self.history_summary_var = tk.StringVar(value="No data yet")
        ttk.Label(summary_card, textvariable=self.history_summary_var,
                 style="Muted.TLabel").pack(anchor="w")

        # Recent list
        recent_card = self.create_card_frame(body)
        recent_card.pack(fill="both", expand=True)

        ttk.Label(recent_card, text="Recent Transactions",
                 style="Heading.TLabel").pack(anchor="w", pady=(0, 10))

        columns = ("hash", "type", "direction", "amount", "date", "status")
        self.history_list = ttk.Treeview(recent_card, columns=columns, show="headings", height=10)
        self.history_list.heading("hash", text="Hash")
        self.history_list.heading("type", text="Type")
        self.history_list.heading("direction", text="Direction")
        self.history_list.heading("amount", text="Amount")
        self.history_list.heading("date", text="Date")
        self.history_list.heading("status", text="Status")

        self.history_list.column("hash", width=200)
        self.history_list.column("type", width=80)
        self.history_list.column("direction", width=100)
        self.history_list.column("amount", width=120)
        self.history_list.column("date", width=150)
        self.history_list.column("status", width=100)

        recent_scroll = ttk.Scrollbar(recent_card, orient="vertical",
                                     command=self.history_list.yview)
        self.history_list.configure(yscrollcommand=recent_scroll.set)
        self.history_list.pack(side="left", fill="both", expand=True)
        recent_scroll.pack(side="left", fill="y")

        # Details area
        detail_card = self.create_card_frame(body)
        detail_card.pack(fill="both", expand=True, pady=(10, 0))

        ttk.Label(detail_card, text="Transaction Details",
                 style="Heading.TLabel").pack(anchor="w", pady=(0, 10))

        self.history_detail_text = scrolledtext.ScrolledText(
            detail_card,
            height=10,
            font=ModernStyle.FONT_MONO,
            bg=ModernStyle.BG_SECONDARY,
            fg=ModernStyle.TEXT_SECONDARY,
            state="disabled",
        )
        self.history_detail_text.pack(fill="both", expand=True)

        self.history_list.bind("<<TreeviewSelect>>", self.on_history_select)

        self.history_records: List[Dict] = []
        self.refresh_history()

    def create_multisig_tab(self):
        """Create enhanced multi-signature workflow"""
        self.multisig_frame = ttk.Frame(self.notebook, style="Main.TFrame")
        self.notebook.add(self.multisig_frame, text="  🔐 Multi-Sig  ")

        # Status card
        status_card = self.create_card_frame(self.multisig_frame)
        status_card.pack(fill="x", pady=(0, 15))

        header = ttk.Frame(status_card, style="Main.TFrame")
        header.pack(fill="x")
        ttk.Label(header, text="Current Multi-Signature Status",
                 style="Heading.TLabel").pack(side="left")
        ttk.Button(header, text="🔄 Refresh", command=self.refresh_multisig_status,
                  style="Primary.TButton").pack(side="right")
        ttk.Button(header, text="📋 Copy", command=self.copy_multisig_status).pack(side="right", padx=(0, 10))

        self.multisig_status_var = tk.StringVar(value="Loading status...")
        ttk.Label(status_card, textvariable=self.multisig_status_var,
                 style="Muted.TLabel").pack(anchor="w", pady=(5, 10))

        self.multisig_status_tree = ttk.Treeview(status_card, columns=("address", "weight"), show="headings", height=4)
        self.multisig_status_tree.heading("address", text="Signer")
        self.multisig_status_tree.heading("weight", text="Weight")
        self.multisig_status_tree.column("address", width=240)
        self.multisig_status_tree.column("weight", width=80)
        self.multisig_status_tree.pack(fill="x")

        # Setup card
        setup_card = self.create_card_frame(self.multisig_frame)
        setup_card.pack(fill="x", pady=(0, 15))

        ttk.Label(setup_card, text="Signer List Setup",
                 style="Heading.TLabel").pack(anchor="w", pady=(0, 10))

        self.multisig_signer_tree = ttk.Treeview(setup_card, columns=("label", "address", "tag", "weight"), show="headings", height=5)
        for col, text, width in (
            ("label", "Label", 120),
            ("address", "Address", 220),
            ("tag", "Tag", 80),
            ("weight", "Weight", 60),
        ):
            self.multisig_signer_tree.heading(col, text=text)
            self.multisig_signer_tree.column(col, width=width)
        self.multisig_signer_tree.pack(fill="x")

        signer_buttons = ttk.Frame(setup_card, style="Main.TFrame")
        signer_buttons.pack(fill="x", pady=(5, 0))
        ttk.Button(signer_buttons, text="➕ Add", command=self.add_signer_entry).pack(side="left")
        ttk.Button(signer_buttons, text="✏️ Edit", command=self.edit_signer_entry).pack(side="left", padx=(5, 0))
        ttk.Button(signer_buttons, text="➖ Remove", command=self.remove_signer_entry).pack(side="left", padx=(5, 0))
        ttk.Button(signer_buttons, text="🧹 Clear", command=self.clear_signer_entries).pack(side="left", padx=(5, 0))

        setup_footer = ttk.Frame(setup_card, style="Main.TFrame")
        setup_footer.pack(fill="x", pady=(10, 0))

        ttk.Label(setup_footer, text="Required signatures:", style="Muted.TLabel").pack(side="left")
        self.multisig_new_quorum_var = tk.StringVar(value="2")
        ttk.Spinbox(setup_footer, from_=1, to=20, textvariable=self.multisig_new_quorum_var, width=8).pack(side="left", padx=(5, 20))

        self.multisig_cost_var = tk.StringVar(value="Cost: --")
        ttk.Label(setup_footer, textvariable=self.multisig_cost_var, style="Muted.TLabel").pack(side="left")

        ttk.Button(setup_footer, text="Apply Signer List", style="Primary.TButton",
                  command=self.apply_signer_list).pack(side="right")

        # Transaction builder
        tx_card = self.create_card_frame(self.multisig_frame)
        tx_card.pack(fill="x", pady=(0, 15))

        ttk.Label(tx_card, text="Prepare Multi-Signature Payment",
                 style="Heading.TLabel").pack(anchor="w", pady=(0, 10))

        form = ttk.Frame(tx_card, style="Main.TFrame")
        form.pack(fill="x")

        ttk.Label(form, text="Destination:", style="Muted.TLabel").grid(row=0, column=0, sticky="w", pady=5)
        self.multisig_dest_var = tk.StringVar()
        ttk.Entry(form, textvariable=self.multisig_dest_var, width=40).grid(row=0, column=1, sticky="ew", padx=(10, 0))
        ttk.Button(form, text="Address Book", command=self.choose_destination_from_book).grid(row=0, column=2, padx=(10, 0))

        ttk.Label(form, text="Amount (XRP):", style="Muted.TLabel").grid(row=1, column=0, sticky="w", pady=5)
        self.multisig_amount_var = tk.StringVar()
        ttk.Entry(form, textvariable=self.multisig_amount_var, width=20).grid(row=1, column=1, sticky="w", padx=(10, 0))

        ttk.Label(form, text="Destination Tag:", style="Muted.TLabel").grid(row=2, column=0, sticky="w", pady=5)
        self.multisig_dest_tag_var = tk.StringVar()
        ttk.Entry(form, textvariable=self.multisig_dest_tag_var, width=20).grid(row=2, column=1, sticky="w", padx=(10, 0))

        ttk.Label(form, text="Memo:", style="Muted.TLabel").grid(row=3, column=0, sticky="w", pady=5)
        self.multisig_memo_var = tk.StringVar()
        ttk.Entry(form, textvariable=self.multisig_memo_var, width=40).grid(row=3, column=1, sticky="ew", padx=(10, 0))

        form.columnconfigure(1, weight=1)

        builder_buttons = ttk.Frame(tx_card, style="Main.TFrame")
        builder_buttons.pack(fill="x", pady=(10, 0))
        ttk.Button(builder_buttons, text="🧾 Prepare Transaction",
                  command=self.prepare_multisig_transaction_action,
                  style="Primary.TButton").pack(side="left")
        ttk.Button(builder_buttons, text="📋 Copy Request",
                  command=self.copy_signing_request).pack(side="left", padx=(10, 0))
        ttk.Button(builder_buttons, text="💾 Save Request",
                  command=self.save_signing_request).pack(side="left", padx=(10, 0))

        self.multisig_tx_status_var = tk.StringVar(value="No transaction prepared yet")
        ttk.Label(tx_card, textvariable=self.multisig_tx_status_var,
                 style="Muted.TLabel").pack(anchor="w", pady=(10, 5))

        self.multisig_tx_preview = scrolledtext.ScrolledText(tx_card, height=6,
                                                            font=ModernStyle.FONT_MONO,
                                                            bg=ModernStyle.BG_SECONDARY,
                                                            fg=ModernStyle.TEXT_SECONDARY,
                                                            state="disabled")
        self.multisig_tx_preview.pack(fill="x")

        # Signing management
        signing_card = self.create_card_frame(self.multisig_frame)
        signing_card.pack(fill="both", expand=True)

        ttk.Label(signing_card, text="Signing Progress",
                 style="Heading.TLabel").pack(anchor="w", pady=(0, 10))

        self.multisig_signing_tree = ttk.Treeview(signing_card, columns=("signer", "weight", "status"), show="headings", height=6)
        self.multisig_signing_tree.heading("signer", text="Signer")
        self.multisig_signing_tree.heading("weight", text="Weight")
        self.multisig_signing_tree.heading("status", text="Status")
        self.multisig_signing_tree.column("signer", width=240)
        self.multisig_signing_tree.column("weight", width=80)
        self.multisig_signing_tree.column("status", width=160)
        self.multisig_signing_tree.pack(fill="both", expand=True)

        signing_buttons = ttk.Frame(signing_card, style="Main.TFrame")
        signing_buttons.pack(fill="x", pady=(10, 0))

        ttk.Button(signing_buttons, text="✍️ Sign as Active Wallet",
                  command=self.sign_as_active_wallet).pack(side="left")
        ttk.Button(signing_buttons, text="📁 Import Signed",
                  command=self.import_signed_package).pack(side="left", padx=(10, 0))
        ttk.Button(signing_buttons, text="📋 Copy Instructions",
                  command=self.copy_signing_request).pack(side="left", padx=(10, 0))
        ttk.Button(signing_buttons, text="🚀 Submit",
                  command=self.submit_multisig_transaction_action,
                  style="Primary.TButton").pack(side="right")

        self.multisig_signing_status_var = tk.StringVar(value="Awaiting transaction preparation")
        ttk.Label(signing_card, textvariable=self.multisig_signing_status_var,
                 style="Muted.TLabel").pack(anchor="w", pady=(5, 0))

        self.refresh_multisig_status()

    def refresh_multisig_status(self):
        manager = self.multi_wallet.get_active_manager()
        if not manager or not manager.wallet:
            self.multisig_status_var.set("Select a wallet to view multisignature status")
            self.multisig_status_tree.delete(*self.multisig_status_tree.get_children())
            return

        status = manager.get_signer_list()
        self.multisig_status = status
        self.multisig_status_tree.delete(*self.multisig_status_tree.get_children())

        if not status.get('enabled'):
            self.multisig_status_var.set("This wallet is currently single-signature.")
            self.multisig_signer_entries = []
        else:
            quorum = status.get('quorum', 0)
            signers = status.get('signers', [])
            self.multisig_status_var.set(
                f"Multisig enabled • Quorum {quorum} of {len(signers)} signers"
            )
            for entry in signers:
                self.multisig_status_tree.insert(
                    "",
                    "end",
                    values=(entry.get('account', ''), entry.get('weight', 1)),
                )
            self.multisig_signer_entries = [
                {
                    'label': entry.get('account', '')[:12] + '...',
                    'address': entry.get('account', ''),
                    'tag': '',
                    'weight': entry.get('weight', 1),
                }
                for entry in signers
            ]

        self.update_multisig_cost_summary()
        self.update_multisig_signer_table()

    def copy_multisig_status(self):
        status = self.multisig_status
        if not status.get('enabled'):
            text = "Wallet is single-signature."
        else:
            signers_txt = "\n".join(
                f"- {entry.get('account')} (weight {entry.get('weight', 1)})"
                for entry in status.get('signers', [])
            )
            text = (
                f"Quorum: {status.get('quorum')}\n"
                f"Signers:\n{signers_txt or 'None'}"
            )
        self.root.clipboard_clear()
        self.root.clipboard_append(text)
        self.update_status("Multisig status copied to clipboard")

    def add_signer_entry(self):
        dialog = SignerEntryDialog(self.root, self.multi_wallet)
        self.root.wait_window(dialog.dialog)
        if dialog.result:
            self.multisig_signer_entries.append(dialog.result)
            self.update_multisig_signer_table()
            self.update_multisig_cost_summary()

    def edit_signer_entry(self):
        selection = self.multisig_signer_tree.selection()
        if not selection:
            messagebox.showinfo("Edit Signer", "Select a signer to edit")
            return
        index = self.multisig_signer_tree.index(selection[0])
        if not (0 <= index < len(self.multisig_signer_entries)):
            return
        dialog = SignerEntryDialog(self.root, self.multi_wallet, title="Edit Signer",
                                   initial=self.multisig_signer_entries[index])
        self.root.wait_window(dialog.dialog)
        if dialog.result:
            self.multisig_signer_entries[index] = dialog.result
            self.update_multisig_signer_table()
            self.update_multisig_cost_summary()

    def remove_signer_entry(self):
        selection = self.multisig_signer_tree.selection()
        if not selection:
            messagebox.showinfo("Remove Signer", "Select a signer to remove")
            return
        index = self.multisig_signer_tree.index(selection[0])
        if 0 <= index < len(self.multisig_signer_entries):
            del self.multisig_signer_entries[index]
            self.update_multisig_signer_table()
            self.update_multisig_cost_summary()

    def clear_signer_entries(self):
        if not self.multisig_signer_entries:
            return
        if messagebox.askyesno("Clear Signers", "Remove all draft signers?", parent=self.root):
            self.multisig_signer_entries.clear()
            self.update_multisig_signer_table()
            self.update_multisig_cost_summary()

    def update_multisig_signer_table(self):
        self.multisig_signer_tree.delete(*self.multisig_signer_tree.get_children())
        for entry in self.multisig_signer_entries:
            self.multisig_signer_tree.insert(
                "",
                "end",
                values=(
                    entry.get('label', ''),
                    entry.get('address', ''),
                    entry.get('tag', ''),
                    entry.get('weight', 1),
                ),
            )

    def update_multisig_cost_summary(self):
        signer_count = len(self.multisig_signer_entries)
        try:
            manager = self.multi_wallet.get_active_manager()
            if not manager:
                self.multisig_cost_var.set("Cost: --")
                return
            cost = manager.estimate_signer_list_cost(signer_count)
            self.multisig_cost_var.set(
                f"Reserve base {cost['reserve_base']:.6f} XRP + signers {cost['additional_reserve']:.6f} XRP"
            )
        except Exception as exc:
            self.multisig_cost_var.set(f"Cost: unavailable ({exc})")

    def apply_signer_list(self):
        manager = self.multi_wallet.get_active_manager()
        if not manager or not manager.wallet:
            messagebox.showerror("Multisig", "Select a wallet first")
            return
        if not self.multisig_signer_entries:
            messagebox.showerror("Multisig", "Add at least one signer")
            return
        try:
            quorum = int(self.multisig_new_quorum_var.get())
        except ValueError:
            messagebox.showerror("Multisig", "Quorum must be a positive number")
            return
        if quorum <= 0 or quorum > len(self.multisig_signer_entries):
            messagebox.showerror("Multisig", "Quorum must be between 1 and the number of signers")
            return

        payload = [
            {'account': entry['address'], 'weight': entry.get('weight', 1)}
            for entry in self.multisig_signer_entries
        ]
        result = manager.create_multisig_wallet(payload, quorum)
        if result.get('success'):
            messagebox.showinfo(
                "Multisig",
                "Signer list transaction submitted. It becomes active after ledger validation.",
            )
            self.update_status("Signer list submitted")
            self.refresh_multisig_status()
        else:
            messagebox.showerror("Multisig", f"Failed to submit signer list:\n{result.get('error')}")

    def choose_destination_from_book(self):
        dialog = AddressBookDialog(self.root, self.multi_wallet)
        self.root.wait_window(dialog.dialog)
        if dialog.result:
            self.multisig_dest_var.set(dialog.result.get('address', ''))
            self.multisig_dest_tag_var.set(dialog.result.get('destination_tag', ''))

    def prepare_multisig_transaction_action(self):
        manager = self.multi_wallet.get_active_manager()
        if not manager or not manager.wallet:
            messagebox.showerror("Multisig", "Select a wallet first")
            return
        if not self.multisig_status.get('enabled'):
            messagebox.showerror("Multisig", "Enable a signer list before preparing a transaction")
            return

        destination = self.multisig_dest_var.get().strip()
        amount = self.multisig_amount_var.get().strip()
        memo = self.multisig_memo_var.get().strip() or None
        tag_value = self.multisig_dest_tag_var.get().strip()
        destination_tag = None
        if tag_value:
            if not tag_value.isdigit():
                messagebox.showerror("Multisig", "Destination tag must be a number")
                return
            destination_tag = int(tag_value)

        if not destination or not destination.startswith('r'):
            messagebox.showerror("Multisig", "Enter a valid destination address")
            return
        if not amount:
            messagebox.showerror("Multisig", "Enter an amount in XRP")
            return

        try:
            tx_json = manager.prepare_payment_transaction(destination, amount, memo, destination_tag)
        except Exception as exc:
            messagebox.showerror("Multisig", f"Failed to prepare transaction:\n{exc}")
            return

        self.multisig_session = {
            'tx_json': tx_json,
            'signatures': {},
            'required_signers': self.multisig_status.get('signers', []),
            'quorum': self.multisig_status.get('quorum', 1),
        }

        self.multisig_tx_preview.config(state="normal")
        self.multisig_tx_preview.delete("1.0", tk.END)
        self.multisig_tx_preview.insert("1.0", json.dumps(tx_json, indent=2))
        self.multisig_tx_preview.config(state="disabled")
        self.multisig_tx_status_var.set(
            f"Transaction prepared. Need {self.multisig_session['quorum']} signatures."
        )
        self.multisig_signing_status_var.set("Awaiting signatures")
        self.update_multisig_signing_table()

    def copy_signing_request(self):
        if not self.multisig_session:
            messagebox.showinfo("Multisig", "Prepare a transaction first")
            return
        tx_json = self.multisig_session['tx_json']
        instructions = (
            "Multi-signature signing request:\n\n"
            f"Account: {tx_json.get('Account')}\n"
            f"Transaction Type: {tx_json.get('TransactionType')}\n"
            f"Amount (drops): {tx_json.get('Amount')}\n"
            f"Destination: {tx_json.get('Destination')}\n"
            "\nJSON payload:\n"
            f"{json.dumps(tx_json, indent=2)}"
        )
        self.root.clipboard_clear()
        self.root.clipboard_append(instructions)
        self.update_status("Signing request copied")

    def save_signing_request(self):
        if not self.multisig_session:
            messagebox.showinfo("Multisig", "Prepare a transaction first")
            return
        filename = filedialog.asksaveasfilename(
            title="Save Signing Request",
            defaultextension=".json",
            filetypes=[("JSON", "*.json"), ("All Files", "*.*")],
        )
        if not filename:
            return
        with open(filename, "w") as f:
            json.dump(self.multisig_session['tx_json'], f, indent=2)
        self.update_status(f"Signing request saved to {filename}")

    def sign_as_active_wallet(self):
        manager = self.multi_wallet.get_active_manager()
        if not manager or not manager.wallet:
            messagebox.showerror("Multisig", "Select a wallet first")
            return
        if not self.multisig_session:
            messagebox.showinfo("Multisig", "Prepare a transaction first")
            return
        tx_json = json.dumps(self.multisig_session['tx_json'])
        result = manager.sign_multisig_transaction(tx_json, manager.wallet)
        if not result.get('success'):
            messagebox.showerror("Multisig", f"Failed to sign:\n{result.get('error')}")
            return
        address = result.get('signer')
        self.multisig_session['signatures'][address] = result
        self.update_status("Signature added")
        self.update_multisig_signing_table()

    def import_signed_package(self):
        if not self.multisig_session:
            messagebox.showinfo("Multisig", "Prepare a transaction first")
            return
        filename = filedialog.askopenfilename(
            title="Import Signed Transaction",
            filetypes=[("JSON", "*.json"), ("All Files", "*.*")],
        )
        if not filename:
            return
        try:
            with open(filename, "r") as f:
                data = json.load(f)
            signer = data.get('signer') or data.get('Signer')
            if not signer:
                raise ValueError("File does not contain signer information")
            self.multisig_session['signatures'][signer] = data
            self.update_multisig_signing_table()
            self.update_status("Imported signed package")
        except Exception as exc:
            messagebox.showerror("Multisig", f"Failed to import signature:\n{exc}")

    def update_multisig_signing_table(self):
        self.multisig_signing_tree.delete(*self.multisig_signing_tree.get_children())
        session = self.multisig_session
        if not session:
            return
        signatures = session.get('signatures', {})
        signers = session.get('required_signers', [])
        collected = 0
        for entry in signers:
            addr = entry.get('account')
            weight = entry.get('weight', 1)
            status = "Signed" if addr in signatures else "Pending"
            if status == "Signed":
                collected += weight
            self.multisig_signing_tree.insert("", "end", values=(addr, weight, status))
        additional = [addr for addr in signatures.keys() if addr not in [s.get('account') for s in signers]]
        for addr in additional:
            self.multisig_signing_tree.insert("", "end", values=(addr, "--", "Additional"))
        quorum = session.get('quorum', 1)
        self.multisig_signing_status_var.set(f"Collected weight {collected} / {quorum}")

    def submit_multisig_transaction_action(self):
        manager = self.multi_wallet.get_active_manager()
        if not manager or not manager.wallet:
            messagebox.showerror("Multisig", "Select a wallet first")
            return
        if not self.multisig_session:
            messagebox.showinfo("Multisig", "Prepare a transaction first")
            return
        signatures = list(self.multisig_session['signatures'].values())
        quorum = self.multisig_session.get('quorum', 1)
        if len(signatures) < quorum:
            messagebox.showinfo("Multisig", "Not enough signatures collected yet")
            return
        result = manager.submit_multisig_transaction(signatures)
        if result.get('success'):
            messagebox.showinfo("Multisig", f"Transaction submitted. Hash: {result['hash']}")
            self.update_status("Submitted multi-signed transaction")
            self.multisig_session = None
            self.multisig_signing_tree.delete(*self.multisig_signing_tree.get_children())
            self.multisig_signing_status_var.set("Transaction submitted")
            self.multisig_tx_preview.config(state="normal")
            self.multisig_tx_preview.delete("1.0", tk.END)
            self.multisig_tx_preview.config(state="disabled")
        else:
            messagebox.showerror("Multisig", f"Failed to submit:\n{result.get('error')}")

    def setup_status_bar(self):
        """Setup the status bar"""
        self.status_frame = ttk.Frame(self.root, style="Main.TFrame")
        self.status_frame.pack(side="bottom", fill="x", padx=20, pady=(0, 20))

        self.status_var = tk.StringVar()
        self.status_label = ttk.Label(self.status_frame, textvariable=self.status_var,
                                    style="Muted.TLabel")
        self.status_label.pack(side="left")

    def update_status(self, message: str):
        """Update status bar"""
        timestamp = datetime.now().strftime('%H:%M:%S')
        self.status_var.set(f"{timestamp} - {message}")

    def update_network_status(self):
        """Update network status display"""
        def update_thread():
            try:
                # Create a temporary manager to get network info
                temp_manager = XRPWalletManager(auto_load_env=False)
                network_info = temp_manager.get_network_info()

                if "error" not in network_info:
                    info_lines = [
                        f"🌐 Network: {network_info.get('network', 'Unknown').title()}",
                        f"📊 Server State: {network_info.get('server_state', 'Unknown')}",
                        f"💰 Base Reserve: {network_info.get('reserve_base', 'Unknown')} XRP",
                        f"📈 Reserve Inc: {network_info.get('reserve_inc', 'Unknown')} XRP",
                    ]
                    validated_ledger = network_info.get("validated_ledger", {})
                    if validated_ledger:
                        info_lines.append(f"🔢 Ledger: {validated_ledger.get('seq', 'Unknown')}")
                    info_text = "\n".join(info_lines)
                else:
                    info_text = f"❌ Network Error: {network_info['error']}"

            except Exception as exc:
                info_text = f"❌ Connection Error: {exc}"

            self.run_on_ui_thread(
                lambda: self.update_text_widget(self.network_status_text, info_text)
            )

        threading.Thread(target=update_thread, daemon=True).start()

    # Wallet management methods (similar to original but adapted for multi-wallet)
    def refresh_wallet_info(self):
        """Refresh active wallet information"""
        manager = self.multi_wallet.get_active_manager()
        if not manager or not manager.wallet:
            active_record = self.multi_wallet.get_active_wallet()
            if active_record:
                self.address_var.set(active_record.address or "Address unavailable")
                self.balance_var.set(
                    f"{active_record.balance} XRP" if active_record.balance else "N/A"
                )
                if hasattr(self, "send_balance_var"):
                    self.send_balance_var.set(
                        f"Available: {active_record.balance} XRP"
                        if active_record.balance not in (None, "", "Error")
                        else "Available: N/A"
                    )
                self.update_receive_tab(active_record.address)
            else:
                self.address_var.set("No wallet selected")
                self.balance_var.set("N/A")
                if hasattr(self, "send_balance_var"):
                    self.send_balance_var.set("Available: N/A")
                self.update_receive_tab(None)
            return

        def refresh_thread():
            try:
                address = manager.wallet.address
                balance_value = manager.get_balance()
                network_info = manager.get_network_info()

                if "error" not in network_info:
                    info_lines = [
                        f"🌐 Network: {manager.network.title()}",
                        f"📊 Server State: {network_info.get('server_state', 'Unknown')}",
                        f"💰 Base Reserve: {network_info.get('reserve_base', 'Unknown')} XRP",
                        f"📈 Reserve Increment: {network_info.get('reserve_inc', 'Unknown')} XRP",
                    ]
                    validated_ledger = network_info.get("validated_ledger", {})
                    if validated_ledger:
                        info_lines.append(
                            f"🔢 Ledger Index: {validated_ledger.get('seq', 'Unknown')}"
                        )
                        info_lines.append(
                            f"🔗 Ledger Hash: {validated_ledger.get('hash', 'Unknown')[:16]}..."
                        )
                    info_text = "\n".join(info_lines)
                    status_message = "Wallet info refreshed"
                else:
                    info_text = f"❌ Error: {network_info['error']}"
                    status_message = f"Error: {network_info['error']}"

            except Exception as exc:
                address = None
                balance_value = None
                info_text = f"❌ Error refreshing wallet: {exc}"
                status_message = f"Error refreshing wallet: {exc}"

            def apply_updates():
                address_value = address or self.address_var.get()
                self.address_var.set(address_value)
                if balance_value is not None:
                    self.balance_var.set(f"{balance_value} XRP")
                    if hasattr(self, "send_balance_var"):
                        self.send_balance_var.set(f"Available: {balance_value} XRP")
                elif info_text.startswith("❌"):
                    self.balance_var.set("Error")
                    if hasattr(self, "send_balance_var"):
                        self.send_balance_var.set("Available: Error")
                if info_text:
                    self.update_text_widget(self.network_text, info_text)
                self.update_status(status_message)
                self.update_receive_tab(address_value if address_value != "No wallet selected" else None)

            self.run_on_ui_thread(apply_updates)

        threading.Thread(target=refresh_thread, daemon=True).start()

    def update_wallet_balances(self):
        """Refresh balance information for all wallets shown on the overview."""

        def balance_thread():
            if not self.multi_wallet.wallets:
                return

            for name, wallet_data in self.multi_wallet.wallets.items():
                try:
                    manager = self.multi_wallet.get_or_create_manager(name)
                    if not manager or not manager.wallet:
                        raise RuntimeError("Wallet not available")

                    balance_value = manager.get_balance()
                    wallet_data.address = manager.wallet.address
                    if balance_value.startswith("Error"):
                        wallet_data.balance = "Error"
                        display_text = balance_value
                    else:
                        wallet_data.balance = balance_value
                        display_text = f"{balance_value} XRP"

                except Exception as exc:
                    wallet_data.balance = "Error"
                    display_text = f"Error: {exc}"

                def apply(name=name, text=display_text, balance=wallet_data.balance, address=wallet_data.address):
                    var = self.wallet_balance_labels.get(name)
                    if var:
                        var.set(text)
                    active = self.multi_wallet.get_active_wallet()
                    if active and active.name == name and hasattr(self, "send_balance_var"):
                        if balance not in (None, "", "Error") and not str(balance).startswith("Error"):
                            self.send_balance_var.set(f"Available: {balance} XRP")
                        else:
                            self.send_balance_var.set("Available: Error")
                        self.update_receive_tab(address)

                self.run_on_ui_thread(apply)

            self.run_on_ui_thread(lambda: self.update_status("Wallet balances refreshed"))

        threading.Thread(target=balance_thread, daemon=True).start()

    def update_receive_tab(self, address: Optional[str]):
        if not hasattr(self, "receive_address_var"):
            return

        if not address or not address.startswith("r"):
            self.receive_address_var.set("Select a wallet to view address")
            self.receive_status_var.set("")
            self.receive_qr_label.configure(image="", text="")
            self.receive_qr_image = None
            self.receive_last_address = None
            return

        self.receive_address_var.set(address)
        if address == self.receive_last_address and address in self.receive_qr_cache:
            self.receive_qr_image = self.receive_qr_cache[address]
            self.receive_qr_label.configure(image=self.receive_qr_image)
            self.receive_status_var.set("")
            return

        self.receive_last_address = address
        self.receive_status_var.set("Fetching QR code...")
        self.receive_qr_label.configure(image="", text="")

        def worker():
            image = self._fetch_qr_image(address)

            def apply():
                if image:
                    self.receive_qr_cache[address] = image
                    self.receive_qr_image = image
                    self.receive_qr_label.configure(image=image)
                    self.receive_status_var.set("")
                else:
                    self.receive_status_var.set("QR unavailable")

            self.run_on_ui_thread(apply)

        threading.Thread(target=worker, daemon=True).start()

    def _fetch_qr_image(self, data: str) -> Optional[tk.PhotoImage]:
        try:
            response = requests.get(
                "https://api.qrserver.com/v1/create-qr-code/",
                params={"size": "240x240", "data": data},
                timeout=10,
            )
            response.raise_for_status()
            encoded = base64.b64encode(response.content).decode("ascii")
            return tk.PhotoImage(data=encoded)
        except Exception as exc:
            self.run_on_ui_thread(lambda: self.receive_status_var.set(f"QR error: {exc}"))
            return None

    @staticmethod
    def _build_explorer_url(address: str, network: str) -> Optional[str]:
        if not address:
            return None
        net = (network or "mainnet").lower()
        if net == "mainnet":
            return f"https://livenet.xrpl.org/accounts/{address}"
        if net == "testnet":
            return f"https://testnet.xrpl.org/accounts/{address}"
        if net == "devnet":
            return f"https://devnet.xrpl.org/accounts/{address}"
        return f"https://xrpscan.com/account/{address}"

    def copy_address(self):
        """Copy wallet address to clipboard"""
        manager = self.multi_wallet.get_active_manager()
        if manager and manager.wallet:
            self.root.clipboard_clear()
            self.root.clipboard_append(manager.wallet.address)
            self.update_status("Address copied to clipboard")
        else:
            messagebox.showwarning("Warning", "No wallet selected")

    def copy_receive_address(self):
        """Copy receive tab address"""
        address = self.receive_address_var.get() if hasattr(self, "receive_address_var") else None
        if address and not address.startswith("Select") and "wallet" not in address.lower():
            self.root.clipboard_clear()
            self.root.clipboard_append(address)
            self.update_status("Receive address copied")
        else:
            messagebox.showinfo("Info", "Select a wallet to copy its address")

    def refresh_receive_qr(self):
        if not hasattr(self, "receive_last_address") or not self.receive_last_address:
            self.update_status("No wallet selected for QR")
            return
        self.receive_qr_cache.pop(self.receive_last_address, None)
        self.update_receive_tab(self.receive_last_address)

    def open_in_explorer(self):
        """Open the active wallet in the appropriate ledger explorer."""
        active = self.multi_wallet.get_active_wallet()
        if not active or not active.address:
            messagebox.showinfo("Info", "Select a wallet to open in the explorer")
            return

        url = self._build_explorer_url(active.address, active.network)
        if not url:
            messagebox.showerror("Explorer Unavailable", "No explorer link available for this network.")
            return

        try:
            webbrowser.open(url)
            self.update_status("Opened explorer")
        except Exception as exc:
            messagebox.showerror("Explorer Error", f"Could not open explorer:\n{exc}")

    def open_address_book(self):
        dialog = AddressBookDialog(self.root, self.multi_wallet)
        self.root.wait_window(dialog.dialog)
        if dialog.result:
            entry = dialog.result
            self.dest_var.set(entry.get("address", ""))
            if hasattr(self, "dest_tag_var"):
                self.dest_tag_var.set(entry.get("destination_tag", ""))

    def send_transaction(self):
        """Send XRP transaction"""
        manager = self.multi_wallet.get_active_manager()
        if not manager or not manager.wallet:
            messagebox.showerror("Error", "No wallet selected")
            return

        destination = self.dest_var.get().strip()
        amount = self.amount_var.get().strip()
        dest_tag_raw = self.dest_tag_var.get().strip() if hasattr(self, "dest_tag_var") else ""
        memo = self.memo_var.get().strip()

        if not destination or not amount:
            messagebox.showerror("Error", "Please fill in destination and amount")
            return

        # Validate address
        if not manager.validate_address(destination):
            messagebox.showerror("Error", "Invalid destination address")
            return

        # Confirm transaction
        confirm_msg = f"Send {amount} XRP to {destination}?"
        if memo:
            confirm_msg += f"\nMemo: {memo}"

        if not messagebox.askyesno("Confirm Transaction", confirm_msg):
            return

        self.update_status("Sending transaction...")

        dest_tag_value = None
        if dest_tag_raw:
            if not dest_tag_raw.isdigit():
                messagebox.showerror("Error", "Destination tag must be a positive integer")
                return
            dest_tag_int = int(dest_tag_raw)
            if not (0 <= dest_tag_int <= 2 ** 32 - 1):
                messagebox.showerror("Error", "Destination tag must be between 0 and 2^32-1")
                return
            dest_tag_value = dest_tag_int

        def send_thread():
            status_message = ""
            result_payload = ""
            success = False
            try:
                result = manager.send_payment(
                    destination,
                    amount,
                    memo if memo else None,
                    dest_tag_value,
                )
                result_payload = json.dumps(result, indent=2)
                success = bool(result.get("success"))
                if success:
                    status_message = f"Transaction sent: {result['hash']}"
                else:
                    status_message = (
                        f"Transaction failed: {result.get('error', 'Unknown error')}"
                    )
            except Exception as exc:
                status_message = f"Error sending transaction: {exc}"
                result_payload = status_message

            def apply():
                self.update_text_widget(self.result_text, result_payload)
                if success:
                    self.dest_var.set("")
                    self.amount_var.set("")
                    if hasattr(self, "dest_tag_var"):
                        self.dest_tag_var.set("")
                    self.memo_var.set("")
                    self.refresh_wallet_info()
                    self.update_wallet_balances()
                self.update_status(status_message)

            self.run_on_ui_thread(apply)

        threading.Thread(target=send_thread, daemon=True).start()

    def refresh_history(self):
        """Refresh transaction history"""
        manager = self.multi_wallet.get_active_manager()
        if not manager or not manager.wallet:
            messagebox.showwarning("Warning", "No wallet selected")
            return

        def history_thread():
            status_message = ""
            entries: List[Dict] = []
            try:
                try:
                    limit = int(self.limit_var.get())
                    if limit <= 0:
                        raise ValueError
                except ValueError:
                    limit = 20
                    self.run_on_ui_thread(lambda: self.limit_var.set("20"))

                transactions = manager.get_transaction_history(limit=limit)

                valid_entries: List[Dict] = []
                errors: List[str] = []
                for tx in transactions:
                    if "error" in tx:
                        errors.append(tx["error"].strip())
                        continue
                    tx_hash = tx.get("hash")
                    if not tx_hash:
                        continue
                    timestamp = tx.get("date")
                    if isinstance(timestamp, (int, float)):
                        try:
                            date_str = datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M:%S")
                        except Exception:
                            date_str = "Unknown"
                    else:
                        date_str = str(timestamp or "Unknown")

                    raw_amount = tx.get("amount") or "N/A"
                    amount = str(raw_amount)
                    if amount != "N/A" and not amount.upper().endswith("XRP") and " " not in amount:
                        amount = f"{amount} XRP"
                    fee = tx.get("fee") or "0"
                    destination = tx.get("destination") or ""
                    dest_tag = tx.get("destination_tag")
                    direction = "Outgoing" if tx.get("account") == manager.wallet.address else "Incoming"

                    valid_entries.append({
                        "hash": tx_hash,
                        "type": tx.get("type", ""),
                        "direction": direction,
                        "amount": amount,
                        "fee": fee,
                        "date": date_str,
                        "status": "Validated" if tx.get("validated") else "Pending",
                        "destination": destination,
                        "destination_tag": dest_tag,
                        "raw": tx,
                    })

                entries = valid_entries
                if errors and not entries:
                    status_message = f"History error: {errors[0]}"
                else:
                    status_message = f"Loaded {len(entries)} transactions"
            except Exception as exc:
                status_message = f"Error loading history: {exc}"

            def apply():
                self.history_records = entries
                self.history_status_var.set(status_message)
                self.history_list.delete(*self.history_list.get_children())
                for entry in entries:
                    self.history_list.insert(
                        "",
                        "end",
                        iid=entry["hash"],
                        values=(
                            entry["hash"][:18] + "..." if len(entry["hash"]) > 21 else entry["hash"],
                            entry["type"],
                            entry["direction"],
                            entry["amount"],
                            entry["date"],
                            entry["status"],
                        ),
                    )
                self.update_history_summary(entries)

            self.run_on_ui_thread(apply)

        threading.Thread(target=history_thread, daemon=True).start()

    def update_history_summary(self, entries: List[Dict]):
        if not entries:
            self.history_summary_var.set("No transactions found")
            return

        total_in = 0.0
        total_out = 0.0
        incoming = outgoing = 0
        for entry in entries:
            amount_str = entry.get("amount", "0")
            try:
                value = float(amount_str.split()[0])
            except Exception:
                continue
            if entry.get("direction") == "Incoming":
                total_in += value
                incoming += 1
            else:
                total_out += value
                outgoing += 1

        summary = (
            f"Incoming: {incoming} ({total_in:.4f} XRP) | "
            f"Outgoing: {outgoing} ({total_out:.4f} XRP)"
        )
        self.history_summary_var.set(summary)

    def on_history_select(self, event=None):
        selection = self.history_list.selection()
        if not selection:
            return
        tx_hash = selection[0]
        record = next((r for r in self.history_records if r.get("hash") == tx_hash), None)
        if not record:
            return
        details = json.dumps(record.get("raw", record), indent=2, default=str)
        self.history_detail_text.config(state="normal")
        self.history_detail_text.delete("1.0", tk.END)
        self.history_detail_text.insert("1.0", details)
        self.history_detail_text.config(state="disabled")

    def copy_selected_hash(self):
        selection = self.history_list.selection()
        if not selection:
            messagebox.showinfo("History", "Select an entry first")
            return
        tx_hash = selection[0]
        self.root.clipboard_clear()
        self.root.clipboard_append(tx_hash)
        self.update_status("Transaction hash copied")

    def open_selected_in_explorer(self):
        selection = self.history_list.selection()
        if not selection:
            messagebox.showinfo("History", "Select an entry first")
            return
        tx_hash = selection[0]
        active = self.multi_wallet.get_active_wallet()
        if not active:
            return
        base = "https://livenet.xrpl.org/transactions/" if active.network == "mainnet" else "https://testnet.xrpl.org/transactions/"
        try:
            webbrowser.open(base + tx_hash)
            self.update_status("Opened transaction in explorer")
        except Exception as exc:
            messagebox.showerror("Explorer", f"Could not open explorer:\n{exc}")

    def create_multisig(self):
        """Create multi-signature wallet"""
        manager = self.multi_wallet.get_active_manager()
        if not manager or not manager.wallet:
            messagebox.showerror("Error", "No wallet selected")
            return

        signers_text = self.signers_text.get("1.0", tk.END).strip()
        quorum = int(self.quorum_var.get())

        if not signers_text:
            messagebox.showerror("Error", "Please enter signer addresses")
            return

        # Parse signers
        signer_addresses = [line.strip() for line in signers_text.split('\n') if line.strip()]

        if len(signer_addresses) < quorum:
            messagebox.showerror("Error", f"Number of signers ({len(signer_addresses)}) must be >= required signatures ({quorum})")
            return

        # Validate addresses
        for address in signer_addresses:
            if not manager.validate_address(address):
                messagebox.showerror("Error", f"Invalid signer address: {address}")
                return

        self.update_status("Creating multi-signature wallet...")

        def create_thread():
            message = ""
            status_message = ""
            is_error = False
            try:
                signers = [{"account": addr, "weight": 1} for addr in signer_addresses]
                result = manager.create_multisig_wallet(signers, quorum)

                if result.get("success"):
                    message = (
                        "Multi-signature wallet created!\n\n"
                        f"Account: {result['multisig_account']}\n"
                        f"Transaction Hash: {result['hash']}"
                    )
                    status_message = "Multi-sig wallet created successfully"
                else:
                    is_error = True
                    error_text = result.get("error", "Unknown error")
                    message = f"Failed to create multi-sig: {error_text}"
                    status_message = "Failed to create multi-sig wallet"

            except Exception as exc:
                is_error = True
                message = f"Error creating multi-sig: {exc}"
                status_message = message

            def apply():
                if is_error:
                    messagebox.showerror("Error", message)
                else:
                    messagebox.showinfo("Success", message)
                self.update_status(status_message)

            self.run_on_ui_thread(apply)

        threading.Thread(target=create_thread, daemon=True).start()

    def load_transaction(self):
        """Load transaction from file"""
        filename = filedialog.askopenfilename(
            title="Load Transaction JSON",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
        )

        if filename:
            try:
                with open(filename, 'r') as f:
                    tx_json = f.read()
                self.tx_json_text.delete("1.0", tk.END)
                self.tx_json_text.insert("1.0", tx_json)
                self.update_status("Transaction loaded from file")
            except Exception as e:
                messagebox.showerror("Error", f"Failed to load transaction: {str(e)}")

    def sign_transaction(self):
        """Sign a multi-signature transaction"""
        manager = self.multi_wallet.get_active_manager()
        if not manager or not manager.wallet:
            messagebox.showerror("Error", "No wallet selected")
            return

        tx_json = self.tx_json_text.get("1.0", tk.END).strip()

        if not tx_json:
            messagebox.showerror("Error", "Please enter transaction JSON")
            return

        self.update_status("Signing transaction...")

        def sign_thread():
            status_message = ""
            is_error = False
            dialog_message = ""
            signed_payload = None
            signer = ""
            try:
                result = manager.sign_multisig_transaction(tx_json, manager.wallet)

                if result.get("success"):
                    signed_payload = result.get("signed_transaction")
                    signer = result.get("signer", "Unknown signer")
                    dialog_message = f"Transaction signed by {signer}"
                    status_message = "Transaction signed successfully"
                else:
                    is_error = True
                    dialog_message = f"Failed to sign transaction: {result.get('error', 'Unknown error')}"
                    status_message = dialog_message

            except Exception as exc:
                is_error = True
                dialog_message = f"Error signing transaction: {exc}"
                status_message = dialog_message

            def apply():
                if not is_error and signed_payload:
                    filename = filedialog.asksaveasfilename(
                        title="Save Signed Transaction",
                        defaultextension=".json",
                        filetypes=[("JSON files", "*.json"), ("All files", "*.*")],
                    )

                    if filename:
                        with open(filename, "w", encoding="utf-8") as f:
                            json.dump(signed_payload, f, indent=2)
                        status = f"Transaction signed and saved to {filename}"
                        self.update_status(status)
                    else:
                        self.update_status(status_message)

                    messagebox.showinfo("Success", dialog_message)
                else:
                    messagebox.showerror("Error", dialog_message)
                    self.update_status(status_message)

            self.run_on_ui_thread(apply)

        threading.Thread(target=sign_thread, daemon=True).start()

    def update_text_widget(self, widget, text):
        """Update text widget content"""
        widget.config(state="normal")
        widget.delete("1.0", tk.END)
        widget.insert("1.0", text)
        widget.config(state="disabled")

    def _process_ui_queue(self):
        """Execute callbacks enqueued from background threads."""
        try:
            while True:
                callback, args, kwargs = self.ui_queue.get_nowait()
                try:
                    callback(*args, **kwargs)
                except Exception as exc:
                    print(f"UI callback error: {exc}")
        except Empty:
            pass
        finally:
            self.root.after(50, self._process_ui_queue)

    def run_on_ui_thread(self, callback, *args, **kwargs):
        """Schedule a callable to run on the Tk main loop."""
        self.ui_queue.put((callback, args, kwargs))


class PasswordDialog:
    """Modal password prompt dialog."""

    def __init__(self, parent, title: str, prompt: str, require_confirmation: bool = False):
        self.result: Optional[str] = None
        self.require_confirmation = require_confirmation

        self.dialog = tk.Toplevel(parent)
        self.dialog.title(title)
        self.dialog.resizable(False, False)
        self.dialog.transient(parent)
        self.dialog.grab_set()

        width = 360
        height = 180 if not require_confirmation else 220
        parent.update_idletasks()
        try:
            parent_x = parent.winfo_rootx()
            parent_y = parent.winfo_rooty()
            parent_w = parent.winfo_width()
            parent_h = parent.winfo_height()
        except Exception:
            parent_x = parent_y = 0
            parent_w = parent_h = 0

        if parent_w <= 1 or parent_h <= 1:
            screen_w = self.dialog.winfo_screenwidth()
            screen_h = self.dialog.winfo_screenheight()
            x = (screen_w - width) // 2
            y = (screen_h - height) // 2
        else:
            x = parent_x + (parent_w - width) // 2
            y = parent_y + (parent_h - height) // 2
        self.dialog.geometry(f"{width}x{height}+{x}+{y}")

        frame = ttk.Frame(self.dialog, padding=20)
        frame.pack(fill="both", expand=True)

        ttk.Label(frame, text=prompt, style="Heading.TLabel", wraplength=width - 40).pack(anchor="w", pady=(0, 10))

        self.password_var = tk.StringVar()
        password_entry = ttk.Entry(frame, textvariable=self.password_var, show="*")
        password_entry.pack(fill="x")
        password_entry.focus()

        if self.require_confirmation:
            ttk.Label(frame, text="Confirm Password", style="Heading.TLabel").pack(anchor="w", pady=(15, 0))
            self.confirm_var = tk.StringVar()
            ttk.Entry(frame, textvariable=self.confirm_var, show="*").pack(fill="x")
        else:
            self.confirm_var = tk.StringVar()

        button_row = ttk.Frame(frame)
        button_row.pack(fill="x", pady=(20, 0))

        ttk.Button(button_row, text="Cancel", command=self.cancel).pack(side="right", padx=(10, 0))
        ttk.Button(button_row, text="OK", command=self.save).pack(side="right")

        self.dialog.bind("<Return>", lambda _: self.save())
        self.dialog.bind("<Escape>", lambda _: self.cancel())
        self.dialog.protocol("WM_DELETE_WINDOW", self.cancel)

    def save(self):
        password = self.password_var.get().strip()
        if not password:
            messagebox.showerror("Validation", "Please enter a password", parent=self.dialog)
            return
        if self.require_confirmation:
            confirm = self.confirm_var.get().strip()
            if password != confirm:
                messagebox.showerror("Validation", "Passwords do not match", parent=self.dialog)
                return

        self.result = password
        self.dialog.destroy()

    def cancel(self):
        self.result = None
        self.dialog.destroy()


class AddressEntryDialog:
    """Dialog to add or edit an address book entry."""

    def __init__(self, parent, title="Address Entry", initial: Optional[Dict[str, str]] = None):
        self.result = None
        self.dialog = tk.Toplevel(parent)
        self.dialog.title(title)
        self.dialog.geometry("400x230")
        self.dialog.resizable(False, False)
        self.dialog.transient(parent)
        self.dialog.grab_set()

        frame = ttk.Frame(self.dialog, padding=20)
        frame.pack(fill="both", expand=True)

        ttk.Label(frame, text="Label", style="Heading.TLabel").pack(anchor="w")
        self.label_var = tk.StringVar(value=(initial or {}).get("label", ""))
        ttk.Entry(frame, textvariable=self.label_var).pack(fill="x", pady=(0, 10))

        ttk.Label(frame, text="Address", style="Heading.TLabel").pack(anchor="w")
        self.address_var = tk.StringVar(value=(initial or {}).get("address", ""))
        ttk.Entry(frame, textvariable=self.address_var).pack(fill="x", pady=(0, 10))

        ttk.Label(frame, text="Destination Tag (optional)", style="Heading.TLabel").pack(anchor="w")
        self.tag_var = tk.StringVar(value=(initial or {}).get("destination_tag", ""))
        ttk.Entry(frame, textvariable=self.tag_var).pack(fill="x", pady=(0, 10))

        button_row = ttk.Frame(frame)
        button_row.pack(fill="x", pady=(10, 0))

        ttk.Button(button_row, text="Cancel", command=self.cancel).pack(side="right", padx=(10, 0))
        ttk.Button(button_row, text="Save", command=self.save).pack(side="right")

        self.dialog.bind("<Return>", lambda _: self.save())
        self.dialog.bind("<Escape>", lambda _: self.cancel())
        self.dialog.protocol("WM_DELETE_WINDOW", self.cancel)

    def save(self):
        label = self.label_var.get().strip()
        address = self.address_var.get().strip()
        tag = self.tag_var.get().strip()

        if not label:
            messagebox.showerror("Validation", "Please provide a label")
            return
        if not address or not address.startswith("r"):
            messagebox.showerror("Validation", "Please provide a valid XRP address")
            return
        if tag and (not tag.isdigit() or not (0 <= int(tag) <= 2 ** 32 - 1)):
            messagebox.showerror("Validation", "Destination tag must be a number between 0 and 2^32-1")
            return

        self.result = {
            "label": label,
            "address": address,
            "destination_tag": tag,
        }
        self.dialog.destroy()

    def cancel(self):
        self.dialog.destroy()


class SignerEntryDialog:
    """Dialog for managing signer entries."""

    def __init__(self, parent, manager: MultiWalletManager, title="Signer", initial: Optional[Dict[str, str]] = None):
        self.manager = manager
        self.result: Optional[Dict[str, str]] = None
        self.dialog = tk.Toplevel(parent)
        self.dialog.title(title)
        self.dialog.geometry("420x260")
        self.dialog.resizable(False, False)
        self.dialog.transient(parent)
        self.dialog.grab_set()

        frame = ttk.Frame(self.dialog, padding=20)
        frame.pack(fill="both", expand=True)

        ttk.Label(frame, text="Label", style="Heading.TLabel").pack(anchor="w")
        self.label_var = tk.StringVar(value=(initial or {}).get('label', ''))
        ttk.Entry(frame, textvariable=self.label_var).pack(fill="x", pady=(0, 10))

        addr_row = ttk.Frame(frame, style="Main.TFrame")
        addr_row.pack(fill="x")
        ttk.Label(addr_row, text="Address", style="Heading.TLabel").pack(anchor="w", side="left")
        ttk.Button(addr_row, text="Address Book", command=self.pick_from_book).pack(side="right")

        self.address_var = tk.StringVar(value=(initial or {}).get('address', ''))
        ttk.Entry(frame, textvariable=self.address_var).pack(fill="x", pady=(0, 10))

        ttk.Label(frame, text="Destination Tag (optional)", style="Heading.TLabel").pack(anchor="w")
        self.tag_var = tk.StringVar(value=(initial or {}).get('tag', '') or (initial or {}).get('destination_tag', ''))
        ttk.Entry(frame, textvariable=self.tag_var).pack(fill="x", pady=(0, 10))

        ttk.Label(frame, text="Weight", style="Heading.TLabel").pack(anchor="w")
        self.weight_var = tk.StringVar(value=str((initial or {}).get('weight', 1)))
        ttk.Entry(frame, textvariable=self.weight_var).pack(fill="x", pady=(0, 10))

        buttons = ttk.Frame(frame)
        buttons.pack(fill="x", pady=(10, 0))
        ttk.Button(buttons, text="Cancel", command=self.cancel).pack(side="right", padx=(10, 0))
        ttk.Button(buttons, text="Save", command=self.save).pack(side="right")

        self.dialog.bind("<Return>", lambda _: self.save())
        self.dialog.bind("<Escape>", lambda _: self.cancel())
        self.dialog.protocol("WM_DELETE_WINDOW", self.cancel)

    def pick_from_book(self):
        dialog = AddressBookDialog(self.dialog, self.manager)
        self.dialog.wait_window(dialog.dialog)
        if dialog.result:
            self.label_var.set(dialog.result.get('name') or dialog.result.get('label', 'Signer'))
            self.address_var.set(dialog.result.get('address', ''))
            self.tag_var.set(dialog.result.get('destination_tag', ''))

    def save(self):
        label = self.label_var.get().strip() or "Signer"
        address = self.address_var.get().strip()
        tag = self.tag_var.get().strip()
        weight_str = self.weight_var.get().strip() or "1"

        if not address or not address.startswith('r'):
            messagebox.showerror("Validation", "Enter a valid XRP Classic address", parent=self.dialog)
            return
        if tag and not tag.isdigit():
            messagebox.showerror("Validation", "Destination tag must be numeric", parent=self.dialog)
            return
        if not weight_str.isdigit() or int(weight_str) <= 0:
            messagebox.showerror("Validation", "Weight must be a positive integer", parent=self.dialog)
            return

        self.result = {
            'label': label,
            'address': address,
            'tag': tag,
            'weight': int(weight_str),
        }
        self.dialog.destroy()

    def cancel(self):
        self.dialog.destroy()

class AddressBookDialog:
    """Dialog listing saved destinations."""

    def __init__(self, parent, manager: MultiWalletManager):
        self.manager = manager
        self.result: Optional[Dict[str, str]] = None
        self.dialog = tk.Toplevel(parent)
        self.dialog.title("Address Book")
        self.dialog.geometry("520x360")
        self.dialog.resizable(False, False)
        self.dialog.transient(parent)
        self.dialog.grab_set()

        container = ttk.Frame(self.dialog, padding=20)
        container.pack(fill="both", expand=True)

        self.listbox = tk.Listbox(container, height=12)
        self.listbox.pack(fill="both", expand=True, side="left")

        scrollbar = ttk.Scrollbar(container, orient="vertical", command=self.listbox.yview)
        scrollbar.pack(side="left", fill="y")
        self.listbox.config(yscrollcommand=scrollbar.set)

        button_frame = ttk.Frame(container)
        button_frame.pack(fill="y", side="right", padx=(10, 0))

        ttk.Button(button_frame, text="Select", command=self.select_entry).pack(fill="x", pady=(0, 5))
        ttk.Button(button_frame, text="Add", command=self.add_entry).pack(fill="x", pady=(0, 5))
        ttk.Button(button_frame, text="Edit", command=self.edit_entry).pack(fill="x", pady=(0, 5))
        ttk.Button(button_frame, text="Delete", command=self.delete_entry).pack(fill="x", pady=(0, 5))
        ttk.Button(button_frame, text="Close", command=self.dialog.destroy).pack(fill="x", pady=(20, 0))

        self.listbox.bind("<Double-Button-1>", lambda _: self.select_entry())
        self.dialog.bind("<Return>", lambda _: self.select_entry())
        self.dialog.bind("<Escape>", lambda _: self.dialog.destroy())

        self.refresh_list()

    def refresh_list(self):
        self.listbox.delete(0, tk.END)
        for entry in self.manager.get_address_book():
            label = entry.get("label", "")
            address = entry.get("address", "")
            display_address = f"{address[:12]}..." if len(address) > 15 else address
            self.listbox.insert(tk.END, f"{label} — {display_address}")

    def get_selected_index(self) -> Optional[int]:
        selection = self.listbox.curselection()
        if not selection:
            return None
        return selection[0]

    def select_entry(self):
        idx = self.get_selected_index()
        if idx is None:
            return
        entries = self.manager.get_address_book()
        if 0 <= idx < len(entries):
            self.result = entries[idx]
            self.dialog.destroy()

    def add_entry(self):
        dialog = AddressEntryDialog(self.dialog, "Add Address")
        self.dialog.wait_window(dialog.dialog)
        if dialog.result:
            self.manager.add_or_update_contact(
                dialog.result["label"],
                dialog.result["address"],
                dialog.result.get("destination_tag"),
            )
            self.refresh_list()

    def edit_entry(self):
        idx = self.get_selected_index()
        if idx is None:
            return
        entries = self.manager.get_address_book()
        if not (0 <= idx < len(entries)):
            return
        dialog = AddressEntryDialog(self.dialog, "Edit Address", initial=entries[idx])
        self.dialog.wait_window(dialog.dialog)
        if dialog.result:
            self.manager.add_or_update_contact(
                dialog.result["label"],
                dialog.result["address"],
                dialog.result.get("destination_tag"),
                index=idx,
            )
            self.refresh_list()

    def delete_entry(self):
        idx = self.get_selected_index()
        if idx is None:
            return
        if messagebox.askyesno("Delete", "Remove this address from the address book?"):
            self.manager.remove_contact(idx)
            self.refresh_list()


class WalletDialog:
    """Dialog for adding a new wallet"""

    def __init__(self, parent, title="Add Wallet"):
        self.result = None

        # Create dialog window
        self.dialog = tk.Toplevel(parent)
        self.dialog.title(title)
        self.dialog.geometry("500x400")
        self.dialog.resizable(False, False)
        self.dialog.transient(parent)
        self.dialog.grab_set()

        # Center the dialog
        self.dialog.update_idletasks()
        x = (self.dialog.winfo_screenwidth() // 2) - (500 // 2)
        y = (self.dialog.winfo_screenheight() // 2) - (400 // 2)
        self.dialog.geometry(f"500x400+{x}+{y}")

        self.setup_dialog()

    def setup_dialog(self):
        """Setup the dialog interface"""
        main_frame = ttk.Frame(self.dialog, padding=20)
        main_frame.pack(fill="both", expand=True)

        # Title
        ttk.Label(main_frame, text="Add New Wallet",
                 font=ModernStyle.FONT_LARGE).pack(pady=(0, 20))

        # Wallet name
        ttk.Label(main_frame, text="Wallet Name:",
                 font=ModernStyle.FONT_MAIN).pack(anchor="w", pady=(0, 5))
        self.name_var = tk.StringVar()
        name_entry = ttk.Entry(main_frame, textvariable=self.name_var, width=50)
        name_entry.pack(fill="x", pady=(0, 15))

        # Private key
        ttk.Label(main_frame, text="Private Key or Seed:",
                 font=ModernStyle.FONT_MAIN).pack(anchor="w", pady=(0, 5))
        ttk.Label(main_frame, text="• 64-char hex: 1a2b3c4d5e6f...\n• XRP seed: sEdTM1uX8pu2do5...",
                 font=("SF Pro Display", 9), foreground=ModernStyle.TEXT_MUTED).pack(anchor="w", pady=(0, 5))
        self.key_var = tk.StringVar()
        key_entry = ttk.Entry(main_frame, textvariable=self.key_var, width=50, show="*")
        key_entry.pack(fill="x", pady=(0, 15))

        # Network selection
        ttk.Label(main_frame, text="Network:",
                 font=ModernStyle.FONT_MAIN).pack(anchor="w", pady=(0, 5))
        self.network_var = tk.StringVar(value="testnet")
        network_frame = ttk.Frame(main_frame)
        network_frame.pack(fill="x", pady=(0, 20))

        ttk.Radiobutton(network_frame, text="Testnet (Safe for testing)",
                       variable=self.network_var, value="testnet").pack(anchor="w")
        ttk.Radiobutton(network_frame, text="Mainnet (Real XRP)",
                       variable=self.network_var, value="mainnet").pack(anchor="w")

        # Buttons
        button_frame = ttk.Frame(main_frame)
        button_frame.pack(fill="x", pady=(20, 0))

        ttk.Button(button_frame, text="Cancel",
                  command=self.cancel).pack(side="right", padx=(10, 0))
        ttk.Button(button_frame, text="Add Wallet",
                  command=self.add_wallet).pack(side="right")

        # Focus on name entry
        name_entry.focus()

    def add_wallet(self):
        """Add the wallet"""
        name = self.name_var.get().strip()
        private_key = self.key_var.get().strip()
        network = self.network_var.get()

        if not name:
            messagebox.showerror("Error", "Please enter a wallet name")
            return

        if not private_key:
            messagebox.showerror("Error", "Please enter a private key or seed")
            return

        self.result = (name, private_key, network)
        self.dialog.destroy()

    def cancel(self):
        """Cancel the dialog"""
        self.dialog.destroy()


def main():
    """Main application entry point"""
    root = tk.Tk()

    # Set a nice app icon if available
    try:
        # You can add an icon file here
        # root.iconbitmap("icon.ico")
        pass
    except:
        pass

    app = ModernXRPWalletGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
