#!/usr/bin/env python3
"""
find_headings.py
Scans full text files of Ibn Ashur and Qurtubi to find exact 
Surah and Ayah headers/delimiters.
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

ASHUR_ID = "1WOEggk1OL3wHI9YtbNB_WYEbDCNcN4Dt" # Ibn Ashur Combined
QURTUBI_ID = "1Dtqdst1yiIGh4659yi2o5e9MvqrCcDvG" # Qurtubi Combined

def get_text(service, file_id):
    request = service.files().get_media(fileId=file_id)
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request, chunksize=1024*1024)
    done = False
    while not done:
        status, done = downloader.next_chunk()
    return fh.getvalue().decode('utf-8', errors='ignore')

def analyze_ashur(text):
    print("\n" + "="*50)
    print("ANALYZING IBN ASHUR HEADINGS")
    print("="*50)
    lines = text.splitlines()
    
    # Let's search for "سورة" headings
    # Typically, a Surah header in Shamela/altafsir is a line like "سورة البقرة" or "سورة الفاتحة"
    # Let's search for lines that contain "سورة" and are very short (e.g. < 40 chars)
    # and print their line numbers and content.
    print("\nShort lines containing 'سورة' (first 40):")
    count = 0
    for idx, line in enumerate(lines):
        striped = line.strip()
        if 'سورة' in striped and len(striped) < 40:
            # Avoid referencing other verses in brackets like [سورة البقرة : 10]
            if not any(c in striped for c in [':', '[', ']']) and not re.search(r'\d', striped):
                print(f"Line {idx:5d}: {striped}")
                count += 1
                if count >= 40:
                    break

    # Let's search for Ayah headings.
    # Often they look like: { ... } or ( ... ) or are prefixed by "قوله تعالى"
    print("\nLines starting with a verse in braces { ... } (first 20):")
    count = 0
    for idx, line in enumerate(lines):
        striped = line.strip()
        if striped.startswith('{') and striped.endswith('}') and len(striped) < 200:
            print(f"Line {idx:5d}: {striped}")
            count += 1
            if count >= 20:
                break
                
def analyze_qurtubi(text):
    print("\n" + "="*50)
    print("ANALYZING AL-QURTUBI HEADINGS")
    print("="*50)
    lines = text.splitlines()
    
    # Search for "سورة" in Qurtubi
    print("\nShort lines containing 'سورة' (first 40):")
    count = 0
    for idx, line in enumerate(lines):
        striped = line.strip()
        if 'سورة' in striped and len(striped) < 50:
            if not any(c in striped for c in [':', '[', ']']) and not re.search(r'\d', striped):
                print(f"Line {idx:5d}: {striped}")
                count += 1
                if count >= 40:
                    break

    # Look for Ayah markers in Qurtubi.
    # Often Qurtubi uses: "قوله تعالى:" or "[سورة ... آية ...]"
    # Let's check for lines containing "آية"
    print("\nLines containing 'آية' and 'سورة' (first 20):")
    count = 0
    for idx, line in enumerate(lines):
        striped = line.strip()
        if 'آية' in striped and 'سورة' in striped and len(striped) < 80:
            print(f"Line {idx:5d}: {striped}")
            count += 1
            if count >= 20:
                break

def main():
    if not os.path.exists('token.json'):
        print("Error: token.json not found.")
        sys.exit(1)
        
    creds = Credentials.from_authorized_user_file('token.json')
    service = build('drive', 'v3', credentials=creds)
    
    print("Downloading Ibn Ashur...")
    ashur_text = get_text(service, ASHUR_ID)
    analyze_ashur(ashur_text)
    
    print("\nDownloading Al-Qurtubi...")
    qurtubi_text = get_text(service, QURTUBI_ID)
    analyze_qurtubi(qurtubi_text)

if __name__ == '__main__':
    main()
