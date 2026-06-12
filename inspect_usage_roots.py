#!/usr/bin/env python3
"""
inspect_usage_roots.py
Inspects the first 1000 lines of Quranic_Usage_Dictionary.txt 
to find how root sections and entries are structured.
"""
import os
import re

FILEPATH = "data/Quranic_Usage_Dictionary.txt"

def main():
    if not os.path.exists(FILEPATH):
        print(f"File {FILEPATH} not found.")
        return
        
    print("Analyzing Quranic Usage Dictionary layout...")
    with open(FILEPATH, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    print(f"Total lines: {len(lines)}")
    
    print("\nFirst 150 lines:")
    print("="*60)
    for idx in range(150):
        if idx < len(lines):
            print(f"{idx:3d}: {lines[idx]}", end="")
    print("="*60)
    
    # Search for patterns that look like root definitions:
    # Roots in this dictionary are usually written with spaces or letters separated by hyphens, 
    # e.g., "أ ب / ʾ-b" or "أ ب ب / ʾ-b-b"
    print("\nScanning for potential root headers (matching short lines with Arabic letters or transliterations)...")
    for idx, line in enumerate(lines[:3000]):
        striped = line.strip()
        # Look for root headers (typically lines with Arabic letters separated by spaces, or containing slashes like 'ء / hamza' or 'أ ب / ʾ-b')
        if '/' in striped and len(striped) < 50:
            print(f"Line {idx:5d}: {striped}")
            
if __name__ == '__main__':
    main()
