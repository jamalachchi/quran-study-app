#!/usr/bin/env python3
"""
download_samples.py
Downloads a sample of each classical text file to the local 'samples/' folder.
Supports text, jsonl, and pdf files.
"""
import os
import io
import sys

try:
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseDownload
    from google.oauth2.credentials import Credentials
except ImportError:
    print("Error: Missing required packages. Run: pip3 install google-api-python-client")
    sys.exit(1)

# Ensure pypdf is installed to extract text from PDF samples
try:
    import pypdf
except ImportError:
    print("Installing pypdf to handle PDF text extraction...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pypdf"])
    import pypdf

# Exact file IDs resolved from the scan
FILE_TARGETS = {
    "tafsir_ashur": {
        "id": "1WOEggk1OL3wHI9YtbNB_WYEbDCNcN4Dt",
        "name": "Ibn_Ashur_Tafsir.txt",
        "type": "text"
    },
    "tafsir_kathir": {
        "id": "1b50fwZE3-kcmmdyW6xxZX7GXc9kCsOXN",
        "name": "Ibn_Kathir_Tafsir.pdf",
        "type": "pdf"
    },
    "tafsir_qurtubi": {
        "id": "1Dtqdst1yiIGh4659yi2o5e9MvqrCcDvG",
        "name": "Al_Qurtubi_Tafsir.txt",
        "type": "text"
    },
    "dict_faris": {
        "id": "1cweFigN5ex47GtCThixRp1xy-bCvrE7Z",
        "name": "Ibn_Faris_Maqayis.jsonl",
        "type": "jsonl"
    },
    "dict_lisan": {
        "id": "1-FuwbsFwwVVAnNXtdtw97w2N1ibu6-Y-",
        "name": "Lisan_Al_Arab.jsonl",
        "type": "jsonl"
    },
    "dict_usage": {
        "id": "1d-H70yZ2c6-nPnoRFTm0VXvBlptJggBM",
        "name": "Quranic_Usage_Dictionary.txt",
        "type": "text"
    }
}

def download_file_chunk(service, file_id, file_name, file_type):
    print(f"Downloading sample for {file_name}...")
    os.makedirs('samples', exist_ok=True)
    sample_path = f"samples/{file_name}"
    
    try:
        request = service.files().get_media(fileId=file_id)
        
        # For huge files, we only want a small chunk to inspect
        # Let's read first 50KB for text/jsonl, and 2MB for PDF
        buffer_size = 2 * 1024 * 1024 if file_type == 'pdf' else 100 * 1024
        
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request, chunksize=buffer_size)
        
        # Get the first chunk
        status, done = downloader.next_chunk()
        data = fh.getvalue()
        
        if file_type == 'pdf':
            # Write full partial PDF bytes so we can open it with a PDF reader
            with open(sample_path, 'wb') as f:
                f.write(data)
            print(f"  -> Saved PDF bytes to {sample_path}")
            
            # Extract and print first few lines of text
            try:
                reader = pypdf.PdfReader(io.BytesIO(data))
                print(f"  -> PDF has {len(reader.pages)} pages (in the downloaded chunk)")
                first_page_text = reader.pages[0].extract_text()
                txt_sample_path = sample_path.replace(".pdf", "_page1.txt")
                with open(txt_sample_path, 'w', encoding='utf-8') as f:
                    f.write(first_page_text)
                print(f"  -> Extracted page 1 text to {txt_sample_path}")
                print(f"=== PAGE 1 PREVIEW ===\n{first_page_text[:500]}\n=====================")
            except Exception as pe:
                print(f"  -> Could not parse PDF text: {pe}")
                
        elif file_type == 'jsonl':
            text = data.decode('utf-8', errors='ignore')
            lines = text.splitlines()
            # Save first 50 lines
            with open(sample_path, 'w', encoding='utf-8') as f:
                f.write("\n".join(lines[:50]))
            print(f"  -> Saved first 50 JSONL lines to {sample_path}")
            print(f"=== JSONL PREVIEW ===\n{lines[0][:300]}\n=====================")
            
        else: # text
            text = data.decode('utf-8', errors='ignore')
            # Save first 5000 characters
            with open(sample_path, 'w', encoding='utf-8') as f:
                f.write(text[:5000])
            print(f"  -> Saved first 5000 chars of text to {sample_path}")
            print(f"=== TEXT PREVIEW ===\n{text[:500]}\n=====================")
            
    except Exception as e:
        print(f"  -> Error downloading sample: {e}")

def main():
    if not os.path.exists('token.json'):
        print("Error: token.json not found. Run inspect_gdrive.py first.")
        sys.exit(1)
        
    creds = Credentials.from_authorized_user_file('token.json')
    service = build('drive', 'v3', credentials=creds)
    
    for key, info in FILE_TARGETS.items():
        download_file_chunk(service, info['id'], info['name'], info['type'])

if __name__ == '__main__':
    main()
