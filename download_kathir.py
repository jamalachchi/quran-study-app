#!/usr/bin/env python3
"""
download_kathir.py
Downloads the full Tafsir Ibn Kathir PDF from Google Drive to the local 'data/' directory.
"""
import os
import io
import sys

try:
    from googleapiclient.discovery import build
    from google.oauth2.credentials import Credentials
    from googleapiclient.http import MediaIoBaseDownload
except ImportError:
    print("Error: googleapiclient not found.")
    sys.exit(1)

FILE_ID = "1b50fwZE3-kcmmdyW6xxZX7GXc9kCsOXN" # Ibn Kathir PDF
FILE_NAME = "Ibn_Kathir_Tafsir.pdf"

def main():
    if not os.path.exists('token.json'):
        print("Error: token.json not found. Run inspect_gdrive.py first.")
        sys.exit(1)
        
    creds = Credentials.from_authorized_user_file('token.json')
    service = build('drive', 'v3', credentials=creds)
    
    os.makedirs('data', exist_ok=True)
    target_path = f"data/{FILE_NAME}"
    
    if os.path.exists(target_path):
        print(f"File {FILE_NAME} already exists. Skipping download.")
        return
        
    print(f"Downloading {FILE_NAME} from Google Drive...")
    try:
        request = service.files().get_media(fileId=FILE_ID)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request, chunksize=2*1024*1024)
        done = False
        while not done:
            status, done = downloader.next_chunk()
            print(f"  Downloaded {int(status.progress() * 100)}%...", end="\r")
        print("\n  Writing to disk...")
        with open(target_path, 'wb') as f:
            f.write(fh.getvalue())
        print(f"  Successfully saved to {target_path} (Size: {os.path.getsize(target_path) / (1024*1024):.2f} MB)")
    except Exception as e:
        print(f"  Error downloading {FILE_NAME}: {e}")

if __name__ == '__main__':
    main()
