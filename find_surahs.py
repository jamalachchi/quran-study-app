#!/usr/bin/env python3
"""
find_surahs.py
Scans the full Ibn Ashur text file on Google Drive (by streaming) 
to find how Surahs are delimited.
"""
import os
import io
import sys
import re

try:
    from googleapiclient.discovery import build
    from google.oauth2.credentials import Credentials
    from googleapiclient.http import MediaIoBaseDownload
except ImportError:
    print("Error: googleapiclient not found.")
    sys.exit(1)

FILE_ID = "1WOEggk1OL3wHI9YtbNB_WYEbDCNcN4Dt" # Ibn Ashur Combined

def main():
    if not os.path.exists('token.json'):
        print("Error: token.json not found.")
        sys.exit(1)
        
    creds = Credentials.from_authorized_user_file('token.json')
    service = build('drive', 'v3', credentials=creds)
    
    request = service.files().get_media(fileId=FILE_ID)
    fh = io.BytesIO()
    
    print("Downloading full text of Ibn Ashur (this might take a few seconds)...")
    downloader = MediaIoBaseDownload(fh, request, chunksize=1024*1024)
    done = False
    while not done:
        status, done = downloader.next_chunk()
        print(f"  Downloaded {int(status.progress() * 100)}%...", end="\r")
    print("\nDownload complete. Processing...")
    
    text = fh.getvalue().decode('utf-8', errors='ignore')
    lines = text.splitlines()
    print(f"Total lines in file: {len(lines)}")
    
    print("\nScanning for 'START OF' or document markers...")
    for idx, line in enumerate(lines):
        if 'START OF' in line or 'END OF' in line or '===' in line:
            # Print surrounding lines
            print(f"Line {idx}: {line.strip()}")
            
    print("\nScanning for potential Surah headers...")
    surah_count = 0
    # Match headings that look like "سورة [Name]" or "[Name] سورة" as a full line (or short line)
    for idx, line in enumerate(lines):
        striped = line.strip()
        # Look for short lines containing 'سورة' (usually under 60 chars)
        if 'سورة' in striped and len(striped) < 60:
            # Filter out references like (سورة البقرة: 12)
            if not re.search(r'[:\d]', striped):
                print(f"Line {idx}: {striped}")
                surah_count += 1
                if surah_count > 30:
                    print("... (truncated list of Surah headers)")
                    break

if __name__ == '__main__':
    main()
