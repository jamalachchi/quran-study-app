#!/usr/bin/env python3
"""
list_all_gdrive_files.py
Lists all files in Google Drive to see if there are other files 
relevant to Tafsir Ibn Kathir or other texts.
"""
import os
import sys
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials

def main():
    if not os.path.exists('token.json'):
        print("Error: token.json not found.")
        sys.exit(1)
        
    creds = Credentials.from_authorized_user_file('token.json')
    service = build('drive', 'v3', credentials=creds)
    
    print("Listing all files in Google Drive...")
    
    files_list = []
    page_token = None
    
    while True:
        try:
            results = service.files().list(
                q="trashed = false",
                pageSize=100,
                pageToken=page_token,
                fields="nextPageToken, files(id, name, mimeType)"
            ).execute()
            
            files = results.get('files', [])
            files_list.extend(files)
            
            page_token = results.get('nextPageToken', None)
            if not page_token:
                break
        except Exception as e:
            print(f"Error fetching files: {e}")
            break
            
    print(f"Total files found: {len(files_list)}")
    
    # Write to a text file for review
    with open('samples/all_gdrive_files.txt', 'w', encoding='utf-8') as f:
        for idx, file_info in enumerate(files_list):
            f.write(f"[{idx}] Name: {file_info['name']} (ID: {file_info['id']}, Type: {file_info['mimeType']})\n")
            
    print("Saved file list to samples/all_gdrive_files.txt")
    
    # Filter for anything containing 'Kathir' or 'كثير'
    print("\nFiles containing 'Kathir' or 'كثير':")
    found = False
    for f in files_list:
        if 'kathir' in f['name'].lower() or 'كثير' in f['name']:
            print(f"  Name: {f['name']} (ID: {f['id']}, Type: {f['mimeType']})")
            found = True
    if not found:
        print("  None found.")

if __name__ == '__main__':
    main()
