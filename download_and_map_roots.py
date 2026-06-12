#!/usr/bin/env python3
import os
import re
import urllib.request
import sqlite3

DB_PATH = 'quran_study.db'
CORPUS_URL = "https://raw.githubusercontent.com/cltk/arabic_morphology_quranic-corpus/master/quranic-corpus-morphology-0.4.txt"
LOCAL_CORPUS_PATH = "data/quranic-corpus-morphology-0.4.txt"

# Buckwalter to Arabic mapping
BW_TO_AR = {
    "'": "ء",
    "|": "آ",
    "O": "أ",
    "W": "ؤ",
    "I": "إ",
    "}": "ئ",
    "A": "ا",
    "b": "ب",
    "p": "ة",
    "t": "ت",
    "v": "ث",
    "j": "ج",
    "H": "ح",
    "x": "خ",
    "d": "د",
    "*": "ذ",
    "r": "ر",
    "z": "ز",
    "s": "س",
    "$": "ش",
    "S": "ص",
    "D": "ض",
    "T": "ط",
    "Z": "ظ",
    "E": "ع",
    "g": "غ",
    "f": "ف",
    "q": "ق",
    "k": "ك",
    "l": "ل",
    "m": "م",
    "n": "ن",
    "h": "ه",
    "w": "و",
    "Y": "ى",
    "y": "ي",
}

def bw_to_arabic(bw_str):
    """Converts a Buckwalter string to Arabic letters separated by spaces."""
    ar_letters = []
    for char in bw_str:
        ar_letters.append(BW_TO_AR.get(char, char))
    return " ".join(ar_letters)

def get_normalized_root(arabic_root):
    """
    Normalizes spelling differences between corpus roots and dictionary roots.
    In the dictionary:
    - Many roots starting with Alif (ا) are stored as Hamza-on-Alif (أ).
      E.g., "ا ل ه" -> "أ ل ه"
    """
    parts = arabic_root.split()
    if not parts:
        return arabic_root
    
    # Normalize initial bare Alif (ا) to Alif with Hamza (أ) for dictionary lookup compatibility
    if parts[0] == "ا":
        parts[0] = "أ"
    
    # Normalizing other common variations if any (e.g. Y/y or ' to أ/ء)
    for i in range(len(parts)):
        if parts[i] == "ى":
            parts[i] = "ي"
        elif parts[i] == "ء":
            if i == 0:
                parts[i] = "أ"
    
    return " ".join(parts)

def main():
    if not os.path.exists("data"):
        os.makedirs("data")

    # Download corpus file if not cached
    if not os.path.exists(LOCAL_CORPUS_PATH):
        print(f"Downloading corpus from {CORPUS_URL}...")
        urllib.request.urlretrieve(CORPUS_URL, LOCAL_CORPUS_PATH)
        print("Download complete.")
    else:
        print(f"Using cached corpus at {LOCAL_CORPUS_PATH}")

    # Read and parse
    print("Parsing Quranic Arabic Corpus...")
    word_roots = {} # location (surah_id:ayah_id:word_id) -> arabic_root
    morphology_entries = [] # list of tuples: (location, part_id, form, tag, features, arabic_root)
    
    location_pattern = re.compile(r'^\((\d+):(\d+):(\d+):(\d+)\)')
    root_pattern = re.compile(r'ROOT:([^\|]+)')

    with open(LOCAL_CORPUS_PATH, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line or line.startswith('#'):
                continue
                
            parts = line.split('\t')
            if len(parts) < 4:
                continue
                
            loc_str = parts[0]
            form = parts[1]
            tag = parts[2]
            features = parts[3]
            
            loc_match = location_pattern.match(loc_str)
            if not loc_match:
                continue
                
            surah, ayah, word, part_id = loc_match.groups()
            word_key = f"{surah}:{ayah}:{word}"
            
            root_match = root_pattern.search(features)
            arabic_root = None
            if root_match:
                bw_root = root_match.group(1)
                ar_root = bw_to_arabic(bw_root)
                arabic_root = get_normalized_root(ar_root)
                word_roots[word_key] = arabic_root

            morphology_entries.append((word_key, int(part_id), form, tag, features, arabic_root))

    print(f"Parsed {len(word_roots)} unique words with roots.")
    print(f"Parsed {len(morphology_entries)} morphology parts.")

    # Create/update DB tables
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create word_roots table
    print("Creating word_roots table in SQLite...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS word_roots (
            location TEXT PRIMARY KEY,
            arabic_root TEXT NOT NULL
        )
    """)
    
    # Create word_morphology table
    print("Creating word_morphology table in SQLite...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS word_morphology (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            location TEXT NOT NULL,
            part_id INTEGER NOT NULL,
            form TEXT NOT NULL,
            tag TEXT NOT NULL,
            features TEXT NOT NULL,
            arabic_root TEXT
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_morph_loc ON word_morphology (location);")
    
    # Seed tables
    print("Seeding word_roots table...")
    insert_roots = [(loc, root) for loc, root in word_roots.items()]
    cursor.executemany("""
        INSERT OR REPLACE INTO word_roots (location, arabic_root)
        VALUES (?, ?)
    """, insert_roots)
    
    print("Seeding word_morphology table...")
    cursor.execute("DELETE FROM word_morphology;") # Clear existing to avoid duplicates on re-run
    cursor.executemany("""
        INSERT INTO word_morphology (location, part_id, form, tag, features, arabic_root)
        VALUES (?, ?, ?, ?, ?, ?)
    """, morphology_entries)
    
    conn.commit()
    
    # Verify counts
    cursor.execute("SELECT COUNT(*) FROM word_roots")
    roots_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM word_morphology")
    morph_count = cursor.fetchone()[0]
    print(f"Successfully seeded {roots_count} words in word_roots.")
    print(f"Successfully seeded {morph_count} entries in word_morphology.")
    
    # Check a sample
    print("\nSample morphology records for word 1:1:1:")
    cursor.execute("SELECT part_id, form, tag, features, arabic_root FROM word_morphology WHERE location = '1:1:1'")
    for row in cursor.fetchall():
        print(f"  Part {row[0]}: Form={row[1]} Tag={row[2]} Features={row[3]} Root={row[4]}")
        
    conn.close()

if __name__ == "__main__":
    main()
