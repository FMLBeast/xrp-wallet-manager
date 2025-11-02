#!/usr/bin/env python3
"""
Modern XRP Wallet Manager Launcher
Beautiful, multi-wallet XRP management application
"""

import sys
import os
import tkinter as tk
from tkinter import messagebox

def check_environment():
    """Check if the environment is properly set up"""
    try:
        # Try importing required modules
        import xrp_wallet
        import gui

        return True, "Environment check passed"

    except ImportError as e:
        return False, f"Missing dependencies: {e}\nPlease run: pip install -r requirements.txt"
    except Exception as e:
        return False, f"Environment error: {e}"

def main():
    """Main launcher function"""
    print("🚀 Starting Modern XRP Wallet Manager...")

    # Check environment
    env_ok, env_message = check_environment()

    if not env_ok:
        # Show error in console and GUI
        print(f"❌ Environment Error: {env_message}")

        # Try to show GUI error if tkinter is available
        try:
            root = tk.Tk()
            root.withdraw()  # Hide the main window
            messagebox.showerror("Environment Error", env_message)
            root.destroy()
        except:
            pass

        sys.exit(1)

    # Environment is good, launch the application
    try:
        print("✅ Environment OK")
        print("💼 Launching Modern XRP Wallet Manager...")
        print("🎨 Beautiful interface with multi-wallet support")
        print("🔐 Secure private key management")
        print()

        from gui import main as gui_main
        gui_main()

    except Exception as e:
        error_msg = f"Failed to launch application: {e}"
        print(f"❌ Error: {error_msg}")

        try:
            root = tk.Tk()
            root.withdraw()
            messagebox.showerror("Launch Error", error_msg)
            root.destroy()
        except:
            pass

        sys.exit(1)

if __name__ == "__main__":
    main()