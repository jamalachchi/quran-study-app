#!/usr/bin/env python3
"""
download_full_texts.py
Downloads the full files for all classical texts from Google Drive 
to a local 'data/' directory.
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

# File IDs and target filenames
FILE_TARGETS = {
    "tafsir_ashur": {
        "id": "1WOEggk1OL3wHI9YtbNB_WYEbDCNcN4Dt",
        "name": "Ibn_Ashur_Tafsir.txt"
    },
    "tafsir_qurtubi": {
        "id": "1Dtqdst1yiIGh4659yi2o5e9MvqrCcDvG",
        "name": "Al_Qurtubi_Tafsir.txt"
    },
    "dict_faris": {
        "id": "1cweFigN5ex47GtCThixRp1xy-bCvrE7Z",
        "name": "Ibn_Faris_Maqayis.jsonl"
    },
    "dict_lisan": {
        "id": "1-FuwbsFwwVVAnNXtdtw97w2N1ibu6-Y-",
        "name": "Lisan_Al_Arab.jsonl"
    },
    "dict_usage": {
        "id": "1d-H70yZ2c6-nPnoRFTm0VXvBlptJggBM",
        "name": "Quranic_Usage_Dictionary.txt"
    }
}

def download_file(service, file_id, file_name):
    os.makedirs('data', exist_ok=True)
    target_path = f"data/{file_name}"
    
    if os.path.exists(target_path):
        print(f"File {file_name} already exists. Skipping download.")
        return
        
    print(f"Downloading {file_name}...")
    try:
        request = service.files().get_media(fileId=file_id)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request, chunksize=1024*1024)
        done = False
        while not done:
            status, done = downloader.next_chunk()
            print(f"  Downloaded {int(status.progress() * 100)}%...", end="\r")
        print("\n  Writing to disk...")
        with open(target_path, 'wb') as f:
            f.write(fh.getvalue())
        print(f"  Successfully saved to {target_path} (Size: {os.path.getsize(target_path) / (1024*1024):.2f} MB)")
    except Exception as e:
        print(f"  Error downloading {file_name}: {e}")

def main():
    if not os.path.exists('token.json'):
        print("Error: token.json not found. Run inspect_gdrive.py first.")
        sys.exit(1)
        
    creds = Credentials.from_authorized_user_file('token.json')
    service = build('drive', 'v3', credentials=creds)
    
    print("Starting download of all classical texts...")
    for key, info in FILE_TARGETS.items():
        download_file(service, info['id'], info['name'])
    print("\nAll downloads finished!")

if __name__ == '__main__':
    main()
