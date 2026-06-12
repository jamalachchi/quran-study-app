#!/usr/bin/env python3
"""
inspect_pdf.py
Extracts text from various pages of the Tafsir Ibn Kathir PDF 
to understand its layout and how Surah/Ayah headings are formatted.
"""
import os
import sys

try:
    import pypdf
except ImportError:
    print("Error: pypdf not installed. Install with: pip3 install pypdf")
    sys.exit(1)

PDF_PATH = "data/Ibn_Kathir_Tafsir.pdf"

def main():
    if not os.path.exists(PDF_PATH):
        print(f"Error: {PDF_PATH} does not exist. Run download_kathir.py first.")
        sys.exit(1)
        
    print(f"Loading PDF {PDF_PATH}...")
    reader = pypdf.PdfReader(PDF_PATH)
    total_pages = len(reader.pages)
    print(f"Total pages: {total_pages}")
    
    # We inspect a few pages across the PDF
    # e.g., page 5 (intro/toc), page 10 (Fatiha start), page 100 (Baqarah), page 500
    inspect_pages = [0, 5, 10, 50, 100, 200, 500, 1000]
    
    os.makedirs('samples', exist_ok=True)
    
    for page_num in inspect_pages:
        if page_num < total_pages:
            print(f"\n--- Extracting Page {page_num} ---")
            page = reader.pages[page_num]
            text = page.extract_text()
            
            sample_file = f"samples/Ibn_Kathir_page_{page_num}.txt"
            with open(sample_file, 'w', encoding='utf-8') as f:
                f.write(text)
                
            print(f"Saved to {sample_file}")
            print(f"=== Page {page_num} Preview (First 500 chars) ===")
            print(text[:500])
            print("===========================================")

if __name__ == '__main__':
    main()
