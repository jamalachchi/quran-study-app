#!/usr/bin/env python3
"""
inspect_gdrive.py
Performs Google OAuth 2.0 flow, lists relevant Tafseer/Dictionary files, 
and downloads a 2000-character sample of each file to inspect their structure.
"""

import os
import io
import sys

# Ensure required libraries are installed
try:
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseDownload
except ImportError:
    print("Error: Missing required Python packages.")
    print("Please install them by running:")
    print("  pip3 install google-api-python-client google-auth-oauthlib google-auth-httplib2")
    sys.exit(1)

# Scopes for Google Drive (Read-only) and Docs (Read-only)
SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/documents.readonly'
]

# Mapping of classical texts we need to search for
TEXT_KEYS = {
    "tafsir_ashur": "Tafsir Ibn Ashur (Arabic)",
    "tafsir_kathir": "Tafsir Ibn Kathir (English)",
    "tafsir_qurtubi": "Tafsir Al-Qurtubi (Arabic)",
    "dict_faris": "Maqayis al-Lughah by Ibn Faris (Arabic)",
    "dict_lisan": "Lisan Al Arab (Arabic)",
    "dict_usage": "Arabic-English Dictionary of Quranic Usage"
}

def authenticate():
    """Authenticates the user and returns the credentials object."""
    creds = None
    # token.json stores the user's access and refresh tokens, and is
    # created automatically when the authorization flow completes for the first time.
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("Refreshing Google Drive access token...")
            try:
                creds.refresh(Request())
            except Exception as e:
                print(f"Failed to refresh token: {e}")
                creds = None
        
        if not creds:
            if not os.path.exists('credentials.json'):
                print("\n" + "="*70)
                print("CRITICAL ERROR: 'credentials.json' is missing from the workspace root.")
                print("Please follow the setup instructions in the implementation plan:")
                print("  /Users/jamalachchi/Desktop/Quran App/credentials.json")
                print("="*70 + "\n")
                sys.exit(1)
                
            print("Starting Google OAuth 2.0 authentication flow...")
            print("Your browser should open to authorize access.")
            flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
            
        # Save the credentials for the next run
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
            print("Successfully authenticated and saved 'token.json'.")
            
    return creds

def search_files(drive_service):
    """Searches for candidate files in Google Drive based on classical text names."""
    print("\nScanning Google Drive for files...")
    found_files = {}
    
    # Search for files with loose names matching our books
    queries = {
        "tafsir_ashur": "name contains 'Ashur' or name contains 'عاشور'",
        "tafsir_kathir": "name contains 'Kathir' or name contains 'كثير'",
        "tafsir_qurtubi": "name contains 'Qurtubi' or name contains 'قرطبي'",
        "dict_faris": "name contains 'Faris' or name contains 'فارس' or name contains 'مقاييس'",
        "dict_lisan": "name contains 'Lisan' or name contains 'لسان'",
        "dict_usage": "name contains 'Usage' or name contains 'Dictionary'"
    }
    
    for key, q in queries.items():
        query = f"({q}) and trashed = false"
        results = drive_service.files().list(
            q=query,
            pageSize=5,
            fields="files(id, name, mimeType)"
        ).execute()
        files = results.get('files', [])
        found_files[key] = files
        
        print(f"\nResults for '{TEXT_KEYS[key]}':")
        if not files:
            print("  -> [NOT FOUND] No matching files found in Drive.")
        else:
            for idx, f in enumerate(files):
                print(f"  [{idx}] Name: {f['name']} (ID: {f['id']}, Type: {f['mimeType']})")
                
    return found_files

def download_sample(drive_service, file_id, mime_type, name):
    """Downloads the first 2000 characters of a file to inspect its content structure."""
    print(f"Downloading sample for '{name}'...")
    
    try:
        if mime_type == 'application/vnd.google-apps.document':
            # It's a Google Doc: export it as plain text
            request = drive_service.files().export_media(fileId=file_id, mimeType='text/plain')
        else:
            # It's a regular file (.txt, etc.): download directly
            request = drive_service.files().get_media(fileId=file_id)
            
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()
            
        content = fh.getvalue().decode('utf-8', errors='ignore')
        
        # Save a 2000-character sample
        os.makedirs('samples', exist_ok=True)
        sample_path = f"samples/{name.replace(' ', '_').lower()}_sample.txt"
        with open(sample_path, 'w', encoding='utf-8') as f:
            f.write(content[:2000])
        print(f"  -> Saved sample to {sample_path} (length: {min(len(content), 2000)} chars)")
        
    except Exception as e:
        print(f"  -> Error downloading {name}: {e}")

def main():
    creds = authenticate()
    if not creds:
        return

    drive_service = build('drive', 'v3', credentials=creds)
    found_files = search_files(drive_service)
    
    print("\n" + "="*70)
    print("INSPECTION & SELECTION")
    print("="*70)
    
    selected_files = {}
    for key, files in found_files.items():
        if not files:
            file_id = input(f"Enter the Google Drive File ID manually for '{TEXT_KEYS[key]}' (or press Enter to skip): ").strip()
            if file_id:
                selected_files[key] = {"id": file_id, "mimeType": "text/plain", "name": TEXT_KEYS[key]}
        elif len(files) == 1:
            print(f"Automatically selected '{files[0]['name']}' for '{TEXT_KEYS[key]}'")
            selected_files[key] = files[0]
        else:
            choice = input(f"Select file index (0-{len(files)-1}) for '{TEXT_KEYS[key]}' (default 0): ").strip()
            idx = int(choice) if choice.isdigit() and 0 <= int(choice) < len(files) else 0
            selected_files[key] = files[idx]
            
    print("\nDownloading samples...")
    for key, file_info in selected_files.items():
        download_sample(drive_service, file_info['id'], file_info['mimeType'], TEXT_KEYS[key])

    print("\nSamples downloaded successfully. Check the 'samples/' folder to inspect file headers and structure.")

if __name__ == '__main__':
    main()
