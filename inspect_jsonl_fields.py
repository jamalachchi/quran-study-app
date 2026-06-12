#!/usr/bin/env python3
"""
inspect_jsonl_fields.py
Reads the first 3 lines of each JSONL file and prints their keys and values.
"""
import os
import json

FILES = [
    "data/Ibn_Faris_Maqayis.jsonl",
    "data/Lisan_Al_Arab.jsonl"
]

def main():
    for filepath in FILES:
        if not os.path.exists(filepath):
            print(f"File {filepath} not found.")
            continue
            
        print("\n" + "="*60)
        print(f"ANALYZING JSONL FILE: {filepath}")
        print("="*60)
        
        try:
            with open(filepath, 'r', encoding='utf-8-sig') as f:
                for idx in range(3):
                    line = f.readline()
                    if not line:
                        break
                    entry = json.loads(line)
                    print(f"\nEntry {idx} keys: {list(entry.keys())}")
                    # Print values
                    for key, val in entry.items():
                        # Truncate text value to keep print clean
                        val_str = str(val)
                        if len(val_str) > 150:
                            val_str = val_str[:150] + "..."
                        print(f"  {key}: {val_str}")
        except Exception as e:
            print(f"Error reading {filepath}: {e}")

if __name__ == '__main__':
    main()
