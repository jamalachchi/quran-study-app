#!/usr/bin/env python3
"""
check_pdf_type.py
Checks if the PDF pages contain fonts and text streams or only images.
"""
import os
import sys
import pypdf

PDF_PATH = "data/Ibn_Kathir_Tafsir.pdf"

def main():
    if not os.path.exists(PDF_PATH):
        print(f"Error: {PDF_PATH} does not exist.")
        sys.exit(1)
        
    reader = pypdf.PdfReader(PDF_PATH)
    page = reader.pages[100] # Check page 100
    
    print("=== Page 100 Keys ===")
    print(list(page.keys()))
    
    if '/Resources' in page:
        res = page['/Resources']
        print("Keys in resources:", list(res.keys()))
        if '/Font' in res:
            print("  -> Fonts found! The PDF contains digital text.")
            print("  Fonts:", list(res['/Font'].keys()))
        else:
            print("  -> NO FONTS FOUND. This is likely a scanned image PDF.")
            
        if '/XObject' in res:
            xobjects = res['/XObject']
            print(f"  -> XObjects found: {len(xobjects)}")
            image_count = 0
            for name in xobjects:
                obj = xobjects[name]
                # resolve indirect objects if necessary
                if hasattr(obj, 'get') and obj.get('/Subtype') == '/Image':
                    image_count += 1
            print(f"  -> Images found: {image_count}")
    else:
        print("  -> No resources found on page.")

if __name__ == '__main__':
    main()
