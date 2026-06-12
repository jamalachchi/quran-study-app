#!/usr/bin/env python3
"""
analyze_structure.py
Downloads a larger chunk (500KB) of the Arabic Tafseer files 
and prints lines containing potential Surah/Ayah dividers.
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

TAFSIR_FILES = {
    "Ibn_Ashur": "1WOEggk1OL3wHI9YtbNB_WYEbDCNcN4Dt",
    "Al_Qurtubi": "1Dtqdst1yiIGh4659yi2o5e9MvqrCcDvG"
}

def analyze_file(service, file_id, name):
    print(f"\n==================================================")
    print(f"ANALYZING STRUCTURE OF: {name}")
    print(f"==================================================")
    
    try:
        # Download first 500KB of the file
        request = service.files().get_media(fileId=file_id)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request, chunksize=500*1024)
        status, done = downloader.next_chunk()
        text = fh.getvalue().decode('utf-8', errors='ignore')
        
        # 1. Look for Surah patterns
        # Typically "سورة ..."
        surah_pattern = re.compile(r'(سورة\s+[أ-ي\s]+)', re.UNICODE)
        surah_matches = surah_pattern.findall(text[:100000])
        print(f"Potential Surah matches in first 100KB: {list(set(surah_matches[:10]))}")
        
        # 2. Look for lines containing "سورة"
        print("\nLines containing 'سورة' (first 10 matches):")
        lines = text.splitlines()
        found_surah_lines = 0
        for idx, line in enumerate(lines):
            if 'سورة' in line and len(line) < 100:
                print(f"  Line {idx}: {line.strip()}")
                found_surah_lines += 1
                if found_surah_lines >= 10:
                    break
                    
        # 3. Look for Ayah markers
        # Let's search for patterns like: (١), (٢), {١}, [١] or numbers in brackets
        print("\nLines with potential Ayah markers (parentheses or braces containing numbers):")
        found_ayah_lines = 0
        for idx, line in enumerate(lines[:1000]): # Scan first 1000 lines
            # Check for numbers in brackets/parentheses or phrases like "قوله تعالى"
            if ('قوله تعالى' in line or 'آية' in line) and len(line) < 150:
                print(f"  Line {idx}: {line.strip()}")
                found_ayah_lines += 1
                if found_ayah_lines >= 10:
                    break
                    
        # Let's write the first 500 lines to a file for manual review
        structure_file = f"samples/{name}_structure.txt"
        with open(structure_file, 'w', encoding='utf-8') as f:
            f.write("\n".join(lines[:2000]))
        print(f"\nWritten first 2000 lines to {structure_file} for detailed manual check.")
        
    except Exception as e:
        print(f"Error analyzing {name}: {e}")

def main():
    if not os.path.exists('token.json'):
        print("Error: token.json not found.")
        sys.exit(1)
        
    creds = Credentials.from_authorized_user_file('token.json')
    service = build('drive', 'v3', credentials=creds)
    
    for name, file_id in TAFSIR_FILES.items():
        analyze_file(service, file_id, name)

if __name__ == '__main__':
    main()
