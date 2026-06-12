#!/usr/bin/env python3
"""
list_folder_contents.py
Lists all files inside the specific Google Drive folder IDs we found.
"""
import os
import sys
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials

FOLDER_IDS = {
    "Ibn Ashur": "1IDLr0GYDuehV35JuqrGUBwUUf-lfggIY",
    "Ibn Kathir": "1ysC9x5L11kdPl3aDmeimuzy_tEr21cS3",
    "Ibn Faris": "10cghNe9V4dz5C3LdaNiarilxZfaCstRT",
    "Lisan Al Arab Folder": "1iCI41-rm0TsgvY-lF1tRnR7ZZ_wznKpq",
    "Quranic Usage Folder": "19PnbbwW2dgPlVK23bpC9_3Cn7OsMuoPf"
}

def main():
    if not os.path.exists('token.json'):
        print("Error: token.json not found. Run inspect_gdrive.py first.")
        sys.exit(1)
        
    creds = Credentials.from_authorized_user_file('token.json')
    service = build('drive', 'v3', credentials=creds)
    
    for folder_name, folder_id in FOLDER_IDS.items():
        print("\n" + "="*50)
        print(f"Contents of folder: {folder_name} (ID: {folder_id})")
        print("="*50)
        
        try:
            query = f"'{folder_id}' in parents and trashed = false"
            results = service.files().list(
                q=query,
                pageSize=50,
                fields="files(id, name, mimeType)"
            ).execute()
            files = results.get('files', [])
            
            if not files:
                print("  [EMPTY] No files found in this folder.")
            else:
                for idx, f in enumerate(files):
                    print(f"  [{idx}] {f['name']} (ID: {f['id']}, Type: {f['mimeType']})")
        except Exception as e:
            print(f"  Error listing folder: {e}")

if __name__ == '__main__':
    main()
