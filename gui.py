"""
Modern XRP Wallet Manager GUI
Enhanced interface with multi-wallet support and beautiful styling
"""

import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext, filedialog, simpledialog
import json
import threading
from datetime import datetime
from typing import Dict, List, Optional
import os
from pathlib import Path

from xrp_wallet import XRPWalletManager


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

    def __init__(self, name: str, private_key: str, network: str = "testnet"):
        self.name = name
        self.private_key = private_key
        self.network = network
        self.address = ""
        self.balance = "0"
        self.is_active = False


class MultiWalletManager:
    """Manager for multiple wallets"""

    def __init__(self):
        self.wallets: Dict[str, WalletData] = {}
        self.active_wallet: Optional[str] = None
        self.wallet_managers: Dict[str, XRPWalletManager] = {}
        self.load_wallets()

    def add_wallet(self, name: str, private_key: str, network: str = "testnet") -> bool:
        """Add a new wallet"""
        try:
            # Test the private key
            temp_manager = XRPWalletManager()
            temp_manager.network = network
            temp_manager.setup_client()

            # Set the private key temporarily to test it
            os.environ['PRIVATE_KEY'] = private_key
            os.environ['NETWORK'] = network

            if temp_manager.load_wallet():
                wallet_data = WalletData(name, private_key, network)
                wallet_data.address = temp_manager.wallet.address

                self.wallets[name] = wallet_data
                self.wallet_managers[name] = temp_manager

                # Save to file
                self.save_wallets()
                return True
            else:
                return False

        except Exception as e:
            print(f"Error adding wallet: {e}")
            return False

    def remove_wallet(self, name: str) -> bool:
        """Remove a wallet"""
        if name in self.wallets:
            if self.active_wallet == name:
                self.active_wallet = None

            del self.wallets[name]
            if name in self.wallet_managers:
                del self.wallet_managers[name]

            self.save_wallets()
            return True
        return False

    def set_active_wallet(self, name: str) -> bool:
        """Set the active wallet"""
        if name in self.wallets:
            self.active_wallet = name

            # Update environment for the active wallet
            wallet = self.wallets[name]
            os.environ['PRIVATE_KEY'] = wallet.private_key
            os.environ['NETWORK'] = wallet.network

            return True
        return False

    def get_active_manager(self) -> Optional[XRPWalletManager]:
        """Get the wallet manager for the active wallet"""
        if self.active_wallet and self.active_wallet in self.wallet_managers:
            return self.wallet_managers[self.active_wallet]
        return None

    def get_active_wallet(self) -> Optional[WalletData]:
        """Get the active wallet data"""
        if self.active_wallet and self.active_wallet in self.wallets:
            return self.wallets[self.active_wallet]
        return None

    def save_wallets(self):
        """Save wallet configurations (without private keys for security)"""
        config_dir = Path.home() / ".xrp_wallet_manager"
        config_dir.mkdir(exist_ok=True)

        config_file = config_dir / "wallets.json"

        # Save only non-sensitive data
        wallet_configs = {}
        for name, wallet in self.wallets.items():
            wallet_configs[name] = {
                "name": wallet.name,
                "network": wallet.network,
                "address": wallet.address,
                # Private key is not saved for security
            }

        try:
            with open(config_file, 'w') as f:
                json.dump({
                    "wallets": wallet_configs,
                    "active_wallet": self.active_wallet
                }, f, indent=2)
        except Exception as e:
            print(f"Error saving wallet config: {e}")

    def load_wallets(self):
        """Load wallet configurations"""
        config_dir = Path.home() / ".xrp_wallet_manager"
        config_file = config_dir / "wallets.json"

        if config_file.exists():
            try:
                with open(config_file, 'r') as f:
                    data = json.load(f)

                # Note: Private keys will need to be re-entered
                # This is intentional for security
                self.active_wallet = data.get("active_wallet")

            except Exception as e:
                print(f"Error loading wallet config: {e}")


class ModernXRPWalletGUI:
    """Modern XRP Wallet Manager GUI with multi-wallet support"""

    def __init__(self, root):
        self.root = root
        self.multi_wallet = MultiWalletManager()
        self.setup_modern_gui()
        self.setup_welcome_screen()

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

        # Configure main frame style
        style.configure("Main.TFrame", background=ModernStyle.BG_PRIMARY)

        # Configure modern button styles
        style.configure("Primary.TButton",
                       background=ModernStyle.PRIMARY,
                       foreground="white",
                       font=ModernStyle.FONT_MAIN,
                       padding=(20, 10))

        style.map("Primary.TButton",
                 background=[("active", ModernStyle.PRIMARY_DARK)])

        # Success button
        style.configure("Success.TButton",
                       background=ModernStyle.SUCCESS,
                       foreground="white",
                       font=ModernStyle.FONT_MAIN,
                       padding=(15, 8))

        # Warning button
        style.configure("Warning.TButton",
                       background=ModernStyle.WARNING,
                       foreground="white",
                       font=ModernStyle.FONT_MAIN,
                       padding=(15, 8))

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
        ttk.Label(balance_frame, text=f"{wallet_data.balance} XRP",
                 style="Heading.TLabel").pack(side="right")

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

    def add_wallet_dialog(self):
        """Show dialog to add a new wallet"""
        dialog = WalletDialog(self.root, "Add New Wallet")
        if dialog.result:
            name, private_key, network = dialog.result

            if self.multi_wallet.add_wallet(name, private_key, network):
                messagebox.showinfo("Success", f"Wallet '{name}' added successfully!")
                self.refresh_wallet_list()
                self.update_status(f"Added wallet: {name}")
            else:
                messagebox.showerror("Error", "Failed to add wallet. Please check the private key.")

    def import_private_key_dialog(self):
        """Show dialog to import a private key"""
        # Get private key
        private_key = simpledialog.askstring("Import Private Key",
                                            "Enter your private key (64 hex characters):",
                                            show='*')
        if not private_key:
            return

        # Get wallet name
        name = simpledialog.askstring("Wallet Name", "Enter a name for this wallet:")
        if not name:
            return

        # Get network
        network = messagebox.askyesno("Network Selection",
                                    "Use mainnet? (No = testnet)")
        network = "mainnet" if network else "testnet"

        if self.multi_wallet.add_wallet(name, private_key, network):
            messagebox.showinfo("Success", f"Private key imported as '{name}'!")
            self.refresh_wallet_list()
            self.update_status(f"Imported wallet: {name}")
        else:
            messagebox.showerror("Error", "Failed to import private key. Please check the key format.")

    def generate_test_wallet_dialog(self):
        """Generate a test wallet"""
        def generate_thread():
            try:
                self.update_status("Generating test wallet...")

                # Create temporary manager for testnet
                temp_manager = XRPWalletManager()
                temp_manager.network = "testnet"
                temp_manager.setup_client()

                address, private_key = temp_manager.generate_test_wallet()

                # Ask for wallet name
                name = simpledialog.askstring("Test Wallet Name",
                                            "Enter a name for this test wallet:",
                                            initialvalue=f"Test-{address[:8]}")
                if name:
                    if self.multi_wallet.add_wallet(name, private_key, "testnet"):
                        self.root.after(0, lambda: messagebox.showinfo("Success",
                            f"Test wallet '{name}' created successfully!\n\n"
                            f"Address: {address}\n"
                            f"Network: Testnet\n\n"
                            "The wallet has been funded with test XRP."))
                        self.root.after(0, self.refresh_wallet_list)
                        self.update_status("Test wallet generated successfully")
                    else:
                        self.update_status("Failed to add generated test wallet")

            except Exception as e:
                self.update_status(f"Error generating test wallet: {e}")

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

        # Memo
        ttk.Label(form_grid, text="Memo (optional):", style="Muted.TLabel").grid(row=2, column=0, sticky="w", pady=10)
        self.memo_var = tk.StringVar()
        memo_entry = ttk.Entry(form_grid, textvariable=self.memo_var, width=50)
        memo_entry.grid(row=2, column=1, sticky="ew", padx=(10, 0), pady=10)

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

    def create_history_tab(self):
        """Create transaction history tab"""
        self.history_frame = ttk.Frame(self.notebook, style="Main.TFrame")
        self.notebook.add(self.history_frame, text="  📊 History  ")

        # Controls card
        controls_card = self.create_card_frame(self.history_frame)
        controls_card.pack(fill="x", pady=(0, 20))

        controls_grid = ttk.Frame(controls_card, style="Main.TFrame")
        controls_grid.pack(fill="x")

        ttk.Button(controls_grid, text="🔄 Refresh History",
                  command=self.refresh_history,
                  style="Primary.TButton").pack(side="left")

        ttk.Label(controls_grid, text="Limit:", style="Muted.TLabel").pack(side="left", padx=(20, 5))
        self.limit_var = tk.StringVar(value="20")
        limit_combo = ttk.Combobox(controls_grid, textvariable=self.limit_var,
                                 values=["10", "20", "50", "100"], width=10)
        limit_combo.pack(side="left", padx=5)

        # History card
        history_card = self.create_card_frame(self.history_frame)
        history_card.pack(fill="both", expand=True)

        ttk.Label(history_card, text="Transaction History",
                 style="Heading.TLabel").pack(anchor="w", pady=(0, 10))

        # Treeview
        tree_frame = ttk.Frame(history_card, style="Main.TFrame")
        tree_frame.pack(fill="both", expand=True)

        self.history_tree = ttk.Treeview(tree_frame,
                                       columns=("Type", "Account", "Destination", "Amount", "Date"),
                                       show="headings")

        # Configure columns
        self.history_tree.heading("Type", text="Type")
        self.history_tree.heading("Account", text="From")
        self.history_tree.heading("Destination", text="To")
        self.history_tree.heading("Amount", text="Amount")
        self.history_tree.heading("Date", text="Date")

        self.history_tree.column("Type", width=100)
        self.history_tree.column("Account", width=150)
        self.history_tree.column("Destination", width=150)
        self.history_tree.column("Amount", width=100)
        self.history_tree.column("Date", width=150)

        # Scrollbars
        v_scrollbar = ttk.Scrollbar(tree_frame, orient="vertical", command=self.history_tree.yview)
        h_scrollbar = ttk.Scrollbar(tree_frame, orient="horizontal", command=self.history_tree.xview)
        self.history_tree.configure(yscrollcommand=v_scrollbar.set, xscrollcommand=h_scrollbar.set)

        self.history_tree.pack(side="left", fill="both", expand=True)
        v_scrollbar.pack(side="right", fill="y")
        h_scrollbar.pack(side="bottom", fill="x")

    def create_multisig_tab(self):
        """Create multi-signature tab"""
        self.multisig_frame = ttk.Frame(self.notebook, style="Main.TFrame")
        self.notebook.add(self.multisig_frame, text="  🔐 Multi-Sig  ")

        # Create multisig card
        create_card = self.create_card_frame(self.multisig_frame)
        create_card.pack(fill="x", pady=(0, 20))

        ttk.Label(create_card, text="Create Multi-Signature Wallet",
                 style="Heading.TLabel").pack(anchor="w", pady=(0, 15))

        # Signers
        ttk.Label(create_card, text="Signer Addresses (one per line):",
                 style="Muted.TLabel").pack(anchor="w")
        self.signers_text = scrolledtext.ScrolledText(create_card, height=5,
                                                    font=ModernStyle.FONT_MONO)
        self.signers_text.pack(fill="x", pady=(5, 10))

        # Quorum
        quorum_frame = ttk.Frame(create_card, style="Main.TFrame")
        quorum_frame.pack(fill="x", pady=(0, 15))

        ttk.Label(quorum_frame, text="Required Signatures:", style="Muted.TLabel").pack(side="left")
        self.quorum_var = tk.StringVar(value="2")
        quorum_spin = ttk.Spinbox(quorum_frame, from_=1, to=10, textvariable=self.quorum_var, width=10)
        quorum_spin.pack(side="left", padx=(10, 0))

        ttk.Button(create_card, text="🔐 Create Multi-Sig Wallet",
                  command=self.create_multisig,
                  style="Primary.TButton").pack()

        # Sign transaction card
        sign_card = self.create_card_frame(self.multisig_frame)
        sign_card.pack(fill="both", expand=True)

        ttk.Label(sign_card, text="Sign Multi-Signature Transaction",
                 style="Heading.TLabel").pack(anchor="w", pady=(0, 10))

        ttk.Label(sign_card, text="Transaction JSON:",
                 style="Muted.TLabel").pack(anchor="w")
        self.tx_json_text = scrolledtext.ScrolledText(sign_card, height=8,
                                                    font=ModernStyle.FONT_MONO)
        self.tx_json_text.pack(fill="both", expand=True, pady=(5, 15))

        buttons_frame = ttk.Frame(sign_card, style="Main.TFrame")
        buttons_frame.pack(fill="x")

        ttk.Button(buttons_frame, text="📁 Load Transaction",
                  command=self.load_transaction).pack(side="left", padx=(0, 10))
        ttk.Button(buttons_frame, text="✍️ Sign Transaction",
                  command=self.sign_transaction,
                  style="Success.TButton").pack(side="left")

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
                temp_manager = XRPWalletManager()
                network_info = temp_manager.get_network_info()

                if 'error' not in network_info:
                    info_text = f"🌐 Network: {network_info.get('network', 'Unknown').title()}\n"
                    info_text += f"📊 Server State: {network_info.get('server_state', 'Unknown')}\n"
                    info_text += f"💰 Base Reserve: {network_info.get('reserve_base', 'Unknown')} XRP\n"
                    info_text += f"📈 Reserve Inc: {network_info.get('reserve_inc', 'Unknown')} XRP\n"

                    validated_ledger = network_info.get('validated_ledger', {})
                    if validated_ledger:
                        info_text += f"🔢 Ledger: {validated_ledger.get('seq', 'Unknown')}\n"
                else:
                    info_text = f"❌ Network Error: {network_info['error']}"

                # Update UI in main thread
                self.root.after(0, lambda: self.update_text_widget(self.network_status_text, info_text))

            except Exception as e:
                error_text = f"❌ Connection Error: {str(e)}"
                self.root.after(0, lambda: self.update_text_widget(self.network_status_text, error_text))

        threading.Thread(target=update_thread, daemon=True).start()

    # Wallet management methods (similar to original but adapted for multi-wallet)
    def refresh_wallet_info(self):
        """Refresh active wallet information"""
        manager = self.multi_wallet.get_active_manager()
        if not manager or not manager.wallet:
            self.address_var.set("No wallet selected")
            self.balance_var.set("N/A")
            return

        def refresh_thread():
            try:
                # Update address
                self.address_var.set(manager.wallet.address)

                # Get balance
                balance = manager.get_balance()
                self.balance_var.set(f"{balance} XRP")

                # Network info
                network_info = manager.get_network_info()
                if 'error' not in network_info:
                    info_text = f"🌐 Network: {manager.network.title()}\n"
                    info_text += f"📊 Server State: {network_info.get('server_state', 'Unknown')}\n"
                    info_text += f"💰 Base Reserve: {network_info.get('reserve_base', 'Unknown')} XRP\n"
                    info_text += f"📈 Reserve Increment: {network_info.get('reserve_inc', 'Unknown')} XRP\n"

                    validated_ledger = network_info.get('validated_ledger', {})
                    if validated_ledger:
                        info_text += f"🔢 Ledger Index: {validated_ledger.get('seq', 'Unknown')}\n"
                        info_text += f"🔗 Ledger Hash: {validated_ledger.get('hash', 'Unknown')[:16]}...\n"
                else:
                    info_text = f"❌ Error: {network_info['error']}"

                self.update_text_widget(self.network_text, info_text)
                self.update_status("Wallet info refreshed")

            except Exception as e:
                self.update_status(f"Error refreshing wallet: {str(e)}")

        threading.Thread(target=refresh_thread, daemon=True).start()

    def copy_address(self):
        """Copy wallet address to clipboard"""
        manager = self.multi_wallet.get_active_manager()
        if manager and manager.wallet:
            self.root.clipboard_clear()
            self.root.clipboard_append(manager.wallet.address)
            self.update_status("Address copied to clipboard")
        else:
            messagebox.showwarning("Warning", "No wallet selected")

    def send_transaction(self):
        """Send XRP transaction"""
        manager = self.multi_wallet.get_active_manager()
        if not manager or not manager.wallet:
            messagebox.showerror("Error", "No wallet selected")
            return

        destination = self.dest_var.get().strip()
        amount = self.amount_var.get().strip()
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

        def send_thread():
            try:
                self.update_status("Sending transaction...")
                result = manager.send_payment(destination, amount, memo if memo else None)

                result_text = json.dumps(result, indent=2)
                self.update_text_widget(self.result_text, result_text)

                if result.get('success'):
                    self.update_status(f"Transaction sent: {result['hash']}")
                    # Clear form
                    self.dest_var.set("")
                    self.amount_var.set("")
                    self.memo_var.set("")
                    # Refresh wallet info
                    self.refresh_wallet_info()
                else:
                    self.update_status(f"Transaction failed: {result.get('error', 'Unknown error')}")

            except Exception as e:
                error_msg = f"Error sending transaction: {str(e)}"
                self.update_text_widget(self.result_text, error_msg)
                self.update_status(error_msg)

        threading.Thread(target=send_thread, daemon=True).start()

    def refresh_history(self):
        """Refresh transaction history"""
        manager = self.multi_wallet.get_active_manager()
        if not manager or not manager.wallet:
            messagebox.showwarning("Warning", "No wallet selected")
            return

        def history_thread():
            try:
                self.update_status("Loading transaction history...")
                limit = int(self.limit_var.get())
                transactions = manager.get_transaction_history(limit=limit)

                # Clear existing items
                for item in self.history_tree.get_children():
                    self.history_tree.delete(item)

                # Add transactions
                for tx in transactions:
                    if 'error' in tx:
                        self.update_status(f"Error loading history: {tx['error']}")
                        return

                    # Format date
                    date_str = datetime.fromtimestamp(tx['date'] + 946684800).strftime("%Y-%m-%d %H:%M") if tx['date'] else "Unknown"

                    self.history_tree.insert("", "end", values=(
                        tx['type'],
                        tx['account'][:20] + "..." if len(tx['account']) > 20 else tx['account'],
                        tx['destination'][:20] + "..." if tx['destination'] and len(tx['destination']) > 20 else tx['destination'],
                        f"{tx['amount']} XRP" if tx['amount'] else "N/A",
                        date_str
                    ))

                self.update_status(f"Loaded {len(transactions)} transactions")

            except Exception as e:
                self.update_status(f"Error loading history: {str(e)}")

        threading.Thread(target=history_thread, daemon=True).start()

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

        def create_thread():
            try:
                self.update_status("Creating multi-signature wallet...")
                signers = [{'account': addr, 'weight': 1} for addr in signer_addresses]
                result = manager.create_multisig_wallet(signers, quorum)

                if result.get('success'):
                    msg = f"Multi-signature wallet created!\n\n"
                    msg += f"Account: {result['multisig_account']}\n"
                    msg += f"Transaction Hash: {result['hash']}"
                    messagebox.showinfo("Success", msg)
                    self.update_status("Multi-sig wallet created successfully")
                else:
                    messagebox.showerror("Error", f"Failed to create multi-sig: {result.get('error', 'Unknown error')}")
                    self.update_status("Failed to create multi-sig wallet")

            except Exception as e:
                error_msg = f"Error creating multi-sig: {str(e)}"
                messagebox.showerror("Error", error_msg)
                self.update_status(error_msg)

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

        def sign_thread():
            try:
                self.update_status("Signing transaction...")
                result = manager.sign_multisig_transaction(tx_json, manager.wallet)

                if result.get('success'):
                    # Save signed transaction
                    filename = filedialog.asksaveasfilename(
                        title="Save Signed Transaction",
                        defaultextension=".json",
                        filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
                    )

                    if filename:
                        with open(filename, 'w') as f:
                            json.dump(result['signed_transaction'], f, indent=2)
                        self.update_status(f"Transaction signed and saved to {filename}")
                    else:
                        self.update_status("Transaction signed successfully")

                    messagebox.showinfo("Success", f"Transaction signed by {result['signer']}")
                else:
                    error_msg = f"Failed to sign transaction: {result.get('error', 'Unknown error')}"
                    messagebox.showerror("Error", error_msg)
                    self.update_status(error_msg)

            except Exception as e:
                error_msg = f"Error signing transaction: {str(e)}"
                messagebox.showerror("Error", error_msg)
                self.update_status(error_msg)

        threading.Thread(target=sign_thread, daemon=True).start()

    def update_text_widget(self, widget, text):
        """Update text widget content"""
        widget.config(state="normal")
        widget.delete("1.0", tk.END)
        widget.insert("1.0", text)
        widget.config(state="disabled")


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
        ttk.Label(main_frame, text="Private Key (64 hex characters):",
                 font=ModernStyle.FONT_MAIN).pack(anchor="w", pady=(0, 5))
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
            messagebox.showerror("Error", "Please enter a private key")
            return

        if len(private_key) != 64:
            messagebox.showerror("Error", "Private key must be 64 hex characters")
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