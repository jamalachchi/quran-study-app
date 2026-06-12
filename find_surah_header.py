#!/usr/bin/env python3
"""
find_surah_header.py
Scans the transition from Surah Yunus to Surah Hud in Ibn Ashur.
"""
import os
import io
import sys
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from googleapiclient.http import MediaIoBaseDownload

ASHUR_ID = "1WOEggk1OL3wHI9YtbNB_WYEbDCNcN4Dt"

def main():
    if not os.path.exists('token.json'):
        print("Error: token.json not found.")
        sys.exit(1)
        
    creds = Credentials.from_authorized_user_file('token.json')
    service = build('drive', 'v3', credentials=creds)
    
    request = service.files().get_media(fileId=ASHUR_ID)
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request, chunksize=1024*1024)
    done = False
    while not done:
        status, done = downloader.next_chunk()
    text = fh.getvalue().decode('utf-8', errors='ignore')
    lines = text.splitlines()
    
    # Print lines 27700 to 27845
    print("=== TRANSITION LINES IN IBN ASHUR ===")
    for idx in range(27700, 27845):
        if idx < len(lines):
            print(f"Line {idx:5d}: {lines[idx]}")

if __name__ == '__main__':
    main()
