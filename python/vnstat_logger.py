#!/usr/bin/env python3
"""
vnstat_logger.py - Fixed for LaunchAgent Environment
Author: Kent
"""

import subprocess
import os
import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import sys

# --- CONFIGURATION ---
# Explicitly define paths to avoid PATH issues in launchd
# UPDATE THIS PATH if 'which vnstat' gave you a different result
VNSTAT_BIN = "/usr/local/bin/vnstat" 
# If you are on Intel Mac, it might be: VNSTAT_BIN = "/usr/local/bin/vnstat"

LOG_DIR = os.path.expanduser("~/Library/vnstat_logs")
LOG_FILE = os.path.join(LOG_DIR, f"usage_{datetime.datetime.now().strftime('%Y-%m')}.csv")
SUMMARY_LOG = os.path.join(LOG_DIR, "weekly_summary.log")

BASE_INTERFACES = ["en0", "utun0"]

# Email Settings (iCloud)
RECIPIENT = "kent@alittlealoha.pro"
FROM_EMAIL = "kentknows@icloud.com"  # REPLACE THIS
SMTP_SERVER = "smtp.mail.me.com"
SMTP_PORT = 587
SMTP_USER = FROM_EMAIL
SMTP_PASS = "jhum-qtcr-srak-sqpm"   

def ensure_dir():
    os.makedirs(LOG_DIR, exist_ok=True)

def check_daemon():
    """Ensure vnstat daemon is running. If not, try to start it."""
    try:
        # Check if daemon is running
        result = subprocess.run(['pgrep', '-x', 'vnstatd'], capture_output=True, text=True)
        if result.returncode != 0:
            print("vnstatd not running. Attempting to start...", file=sys.stderr)
            # Try to start the daemon (requires sudo, but launchd agents usually run as user)
            # If this fails, the user might need to start it manually once or configure launchd for the daemon
            subprocess.run(['sudo', VNSTAT_BIN, '--daemon'], capture_output=True, text=True)
            import time
            time.sleep(2) # Wait for daemon to initialize
    except Exception as e:
        print(f"Daemon check failed: {e}", file=sys.stderr)

def get_vnstat_data(interface, mode='m'):
    """
    Runs vnstat with explicit binary path.
    """
    # Ensure daemon is running first
    check_daemon()

    try:
        # Use the explicit path
        cmd = [VNSTAT_BIN, '-i', interface, '--oneline']
        
        # Run with a timeout
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
        
        # Fallback for utun
        if interface.startswith('utun'):
            list_cmd = [VNSTAT_BIN, '--iflist']
            list_result = subprocess.run(list_cmd, capture_output=True, text=True, timeout=10)
            if list_result.returncode == 0:
                for line in list_result.stdout.splitlines():
                    if 'utun' in line:
                        parts = line.split()
                        if parts:
                            found_iface = parts[0]
                            check_cmd = [VNSTAT_BIN, '-i', found_iface, '--oneline']
                            check_res = subprocess.run(check_cmd, capture_output=True, text=True, timeout=10)
                            if check_res.returncode == 0:
                                return check_res.stdout.strip()
        return None
    except FileNotFoundError:
        print(f"ERROR: vnstat binary not found at {VNSTAT_BIN}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Error querying vnstat: {e}", file=sys.stderr)
        return None

def log_daily_data():
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    with open(LOG_FILE, 'a') as f:
        f.write(f"{timestamp}\n")
        
        for iface in BASE_INTERFACES:
            data = get_vnstat_data(iface)
            if data:
                f.write(f"  {iface}|{data}\n")
            else:
                f.write(f"  {iface}: NOT FOUND or No Data\n")
        f.write("---\n")

def generate_weekly_summary():
    summary_lines = [
        f"Weekly Network Usage Report - {datetime.datetime.now().strftime('%Y-%m-%d')}",
        "=" * 40,
        f"Recipient: {RECIPIENT}",
        f"Sent From: {FROM_EMAIL}",
        ""
    ]
    
    for iface in BASE_INTERFACES:
        data = get_vnstat_data(iface, mode='w')
        if data:
            actual_iface = iface
            if iface.startswith('utun'):
                list_result = subprocess.run([VNSTAT_BIN, '--iflist'], capture_output=True, text=True)
                for line in list_result.stdout.splitlines():
                    if 'utun' in line:
                        parts = line.split()
                        if parts and parts[0].startswith('utun'):
                            check = subprocess.run([VNSTAT_BIN, '-i', parts[0], '--oneline'], capture_output=True, text=True)
                            if check.returncode == 0:
                                actual_iface = parts[0]
                                break
            
            summary_lines.append(f"Interface: {actual_iface}")
            summary_lines.append(f"  {data}")
            summary_lines.append("")
    
    summary_lines.append("=" * 40)
    summary_lines.append(f"Generated by vnstat_logger.py on {os.uname().nodename}")
    
    return "\n".join(summary_lines)

def send_email(subject, body):
    msg = MIMEMultipart()
    msg['From'] = FROM_EMAIL
    msg['To'] = RECIPIENT
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))

    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(SMTP_USER, SMTP_PASS)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"Email failed: {e}", file=sys.stderr)
        return False

def main():
    ensure_dir()
    log_daily_data()
    
    if datetime.datetime.now().weekday() == 6:
        print("It's Sunday. Generating report...")
        body = generate_weekly_summary()
        
        with open(SUMMARY_LOG, 'a') as f:
            f.write(f"\n--- {datetime.datetime.now()} ---\n")
            f.write(body)
            f.write("\n\n")
        
        subject = f"[Weekly Report] Network Usage Summary - {datetime.datetime.now().strftime('%Y-%m-%d')}"
        if send_email(subject, body):
            with open(SUMMARY_LOG, 'a') as f:
                f.write("[SUCCESS] Email sent\n")
            print("Email sent.")
        else:
            with open(SUMMARY_LOG, 'a') as f:
                f.write("[ERROR] Email failed\n")
            print("Email failed.")
    else:
        print("Daily logging complete.")

if __name__ == "__main__":
    main()