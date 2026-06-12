#!/usr/bin/env python3
"""
print_context.py
Downloads and prints context lines for Ibn Ashur and Qurtubi to understand formatting.
"""
import os
import io
import sys
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from googleapiclient.http import MediaIoBaseDownload

ASHUR_ID = "1WOEggk1OL3wHI9YtbNB_WYEbDCNcN4Dt" # Ibn Ashur Combined
QURTUBI_ID = "1Dtqdst1yiIGh4659yi2o5e9MvqrCcDvG" # Qurtubi Combined

def get_lines_around(service, file_id, target_line, window=15):
    request = service.files().get_media(fileId=file_id)
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request, chunksize=1024*1024)
    done = False
    while not done:
        status, done = downloader.next_chunk()
    text = fh.getvalue().decode('utf-8', errors='ignore')
    lines = text.splitlines()
    
    start = max(0, target_line - window)
    end = min(len(lines), target_line + window)
    print(f"\nLines {start} to {end}:")
    for idx in range(start, end):
        print(f"  Line {idx:5d}: {lines[idx]}")

def main():
    if not os.path.exists('token.json'):
        print("Error: token.json not found.")
        sys.exit(1)
        
    creds = Credentials.from_authorized_user_file('token.json')
    service = build('drive', 'v3', credentials=creds)
    
    print("\n=== IBN ASHUR CONTEXT (around Line 27840, Hud start) ===")
    get_lines_around(service, ASHUR_ID, 27840)
    
    print("\n=== AL-QURTUBI CONTEXT (around Line 4400, Fatiha start) ===")
    get_lines_around(service, QURTUBI_ID, 4400)
    
    print("\n=== AL-QURTUBI CONTEXT (around Line 6558, Baqarah start) ===")
    get_lines_around(service, QURTUBI_ID, 6558)

if __name__ == '__main__':
    main()
