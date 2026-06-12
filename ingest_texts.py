#!/usr/bin/env python3
"""
ingest_texts.py
Parses downloaded classical text files and JSONL files, 
downloads English Tafsir Ibn Kathir JSON, and seeds the SQLite database.
"""
import os
import io
import sys
import re
import json
import sqlite3
import urllib.request

DB_PATH = 'quran_study.db'
SCHEMA_PATH = 'schema.sql'

# Arabic Surah names mapped to Surah IDs (1 to 114)
SURAH_ARABIC_NAMES = {
    "الفاتحة": 1, "البقرة": 2, "آل عمران": 3, "النساء": 4, "المائدة": 5,
    "الأنعام": 6, "الأعراف": 7, "الأنفال": 8, "التوبة": 9, "يونس": 10,
    "هود": 11, "يوسف": 12, "الرعد": 13, "إبراهيم": 14, "الحجر": 15,
    "النحل": 16, "الإسراء": 17, "الكهف": 18, "مريم": 19, "طه": 20,
    "الأنبياء": 21, "الحج": 22, "المؤمنون": 23, "النور": 24, "الفرقان": 25,
    "الشعراء": 26, "النمل": 27, "القصص": 28, "العنكبوت": 29, "الروم": 30,
    "لقمان": 31, "السجدة": 32, "الأحزاب": 33, "سبأ": 34, "فاطر": 35,
    "يس": 36, "الصافات": 37, "ص": 38, "الزمر": 39, "غافر": 40,
    "فصلت": 41, "الشورى": 42, "الزخرف": 43, "الدخان": 44, "الجاثية": 45,
    "الأحقاف": 46, "محمد": 47, "الفتح": 48, "الحجرات": 49, "ق": 50,
    "الذاريات": 51, "الطور": 52, "النجم": 53, "القمـر": 54, "القرن": 54, "القمر": 54,
    "الرحمن": 55, "الواقعة": 56, "الحديد": 57, "المجادلة": 58, "الحشر": 59,
    "الممتحنة": 60, "الصف": 61, "الجمعة": 62, "المنافقون": 63, "التغابن": 64,
    "الطلاق": 65, "التحريم": 66, "الملك": 67, "القلم": 68, "الحاقة": 69,
    "المعارج": 70, "نوح": 71, "الجن": 72, "المزمل": 73, "المدثر": 74,
    "القيامة": 75, "الإنسان": 76, "الدهر": 76, "المرسلات": 77, "النبأ": 78,
    "النازعات": 79, "عبس": 80, "التكوير": 81, "الانفطار": 82, "المطففين": 83,
    "الانشقاق": 84, "البروج": 85, "الطارق": 86, "الأعلى": 87, "الغاشية": 88,
    "الفجر": 89, "البلد": 90, "الشمس": 91, "الليل": 92, "الضحى": 93,
    "الشرح": 94, "الانشراح": 94, "التين": 95, "العلق": 96, "القدر": 97,
    "البينة": 98, "الزلزلة": 99, "العاديات": 100, "القارعة": 101, "التكاثر": 102,
    "العصر": 103, "الهمزة": 104, "الفيل": 105, "قريش": 106, "الماعون": 107,
    "الكوثر": 108, "الكافرون": 109, "النصر": 110, "المسد": 111, "اللها": 111, "اللهب": 111,
    "الإخلاص": 112, "التوحيد": 112, "الفلق": 113, "الناس": 114
}

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    print(f"Initializing database schema from {SCHEMA_PATH}...")
    if not os.path.exists(SCHEMA_PATH):
        print(f"Error: {SCHEMA_PATH} not found.")
        sys.exit(1)
    conn = get_db_connection()
    with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
        conn.executescript(f.read())
    conn.commit()
    conn.close()
    print("Database schema successfully initialized.")

# =====================================================================
# UTILITIES
# =====================================================================

def eastern_to_western_num(num_str):
    """Converts Eastern Arabic numerals (٠-٩) to standard ASCII numbers (0-9)."""
    mapping = {'٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'}
    result = ""
    for char in num_str:
        if char in mapping:
            result += mapping[char]
        elif char.isdigit():
            result += char
        elif char in ['-', ' ', '،', ',']:
            result += '-'
    return result

def clean_ayah_range(ayah_str):
    """Parses a string representing an Ayah number or range into a list of Ayah IDs."""
    western_str = eastern_to_western_num(ayah_str)
    # Find all sequences of numbers
    parts = [x for x in western_str.split('-') if x.strip()]
    if not parts:
        return []
    
    try:
        numbers = [int(x) for x in parts]
        if len(numbers) == 1:
            return [numbers[0]]
        elif len(numbers) >= 2:
            # e.g., 280-281
            return list(range(numbers[0], numbers[1] + 1))
    except ValueError:
        pass
    return []

# =====================================================================
# TAFSEER PARSERS
# =====================================================================

def make_diacritic_regex(word):
    tashkeel_regex = r'[\u0617-\u061A\u064B-\u0652]*'
    parts = []
    for char in word:
        if char == ' ':
            parts.append(r'\s+')
        else:
            parts.append(re.escape(char) + tashkeel_regex)
    return ''.join(parts)

def remove_diacritics(text):
    tashkeel_pattern = re.compile(r'[\u0617-\u061A\u064B-\u0652]')
    return tashkeel_pattern.sub('', text)

def parse_ibn_ashur(filepath):
    print(f"\nParsing Ibn Ashur from {filepath}...")
    if not os.path.exists(filepath):
        print(f"File {filepath} not found. Skipping.")
        return []
        
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        text = f.read()
        
    lines = text.splitlines()
    
    verse_headers = []
    for idx, line in enumerate(lines):
        line_str = line.strip()
        if re.search(r'\(\d+\)$', line_str) and not re.search(r'\(\d+/\d+\)$', line_str):
            nums = [int(num) for num in re.findall(r'\((\d+)\)', line_str) if '/' not in num]
            if nums:
                verse_headers.append((idx, nums, line_str))
                
    print(f"  Found {len(verse_headers)} verse headers in Ibn Ashur.")
    
    entries = []
    surah_id = 0
    
    for h_idx, (line_num, nums, header_text) in enumerate(verse_headers):
        if 1 in nums:
            surah_id += 1
            
        c_start = line_num + 1
        c_end = verse_headers[h_idx+1][0] if h_idx+1 < len(verse_headers) else len(lines)
        
        commentary_lines = []
        for l_idx in range(c_start, c_end):
            l_str = lines[l_idx].strip()
            if not l_str:
                continue
            if re.match(r'^\(\d+/\d+\)$', l_str):
                continue
            if l_str.startswith('START OF') or l_str.startswith('===='):
                continue
            if l_str.startswith('http://'):
                continue
            if 'تم إعداد هذا الملف آليا' in l_str or 'المكتبة الشاملة' in l_str:
                continue
            commentary_lines.append(lines[l_idx])
            
        commentary = "\n".join(commentary_lines).strip()
        
        if commentary and surah_id <= 114:
            for a_id in nums:
                entries.append((surah_id, a_id, 'ibn_ashur', commentary))
                
    return entries

def parse_qurtubi(filepath):
    print(f"\nParsing Al-Qurtubi from {filepath}...")
    if not os.path.exists(filepath):
        print(f"File {filepath} not found. Skipping.")
        return []
        
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        text = f.read()
        
    pattern = re.compile(r'\[سورة\s+([^\(]+?)\s*\((\d+|[\u0660-\u0669]+)\):\s*([^\]]+)\]')
    matches = list(pattern.finditer(text))
    if not matches:
        print("  No Qurtubi headers found!")
        return []
        
    print(f"  Found {len(matches)} verse headers in Al-Qurtubi.")
    
    grouped_content = {}
    last_ayah_in_surah = {}
    prev_surah_id = 1
    
    # Reverse map for Surah Name to ID
    surah_id_to_name = {v: k for k, v in SURAH_ARABIC_NAMES.items()}
    
    for idx, m in enumerate(matches):
        surah_num_str = m.group(2)
        ayah_range_str = m.group(3)
        
        surah_id = int(eastern_to_western_num(surah_num_str))
        ayah_ids = clean_ayah_range(ayah_range_str)
        if not ayah_ids:
            continue
            
        start_pos = m.end()
        end_pos = matches[idx+1].start() if idx+1 < len(matches) else len(text)
        
        commentary = text[start_pos:end_pos].strip()
        if not commentary:
            continue
            
        if surah_id != prev_surah_id:
            prev_m = matches[idx-1]
            block_between = text[prev_m.end():m.start()].strip()
            
            surah_name = surah_id_to_name.get(surah_id, "")
            split_idx = -1
            if surah_name:
                regex_str = make_diacritic_regex('سورة ' + surah_name)
                split_match = re.search(regex_str, block_between)
                if split_match:
                    split_idx = split_match.start()
            
            if split_idx != -1:
                prev_commentary = block_between[:split_idx].strip()
                new_surah_intro = block_between[split_idx:].strip()
                
                prev_ayah = last_ayah_in_surah.get(prev_surah_id, 1)
                prev_key = (prev_surah_id, prev_ayah)
                if prev_key in grouped_content:
                    grouped_content[prev_key][-1] += "\n\n" + prev_commentary
                
                commentary = new_surah_intro + "\n\n" + commentary
                
            prev_surah_id = surah_id
            
        prev_last_ayah = last_ayah_in_surah.get(surah_id, 0)
        min_current_ayah = min(ayah_ids)
        target_ayah_ids = list(ayah_ids)
        
        if prev_last_ayah > 0 and min_current_ayah > prev_last_ayah + 1:
            gap_verses = list(range(prev_last_ayah + 1, min_current_ayah))
            target_ayah_ids = gap_verses + target_ayah_ids
            
        last_ayah_in_surah[surah_id] = max(ayah_ids)
        
        for a_id in target_ayah_ids:
            key = (surah_id, a_id)
            if key not in grouped_content:
                grouped_content[key] = []
            grouped_content[key].append(commentary)
            
    entries = []
    for (s_id, a_id), blocks in grouped_content.items():
        full_commentary = "\n\n".join(blocks).strip()
        if full_commentary:
            entries.append((s_id, a_id, 'qurtubi', full_commentary))
            
    return entries

def download_and_parse_kathir():
    """Downloads digital English Tafsir Ibn Kathir from GitHub JSON API and structures it."""
    print("\nDownloading Tafsir Ibn Kathir (English) JSON from GitHub...")
    entries = []
    
    for surah_id in range(1, 115):
        print(f"  Downloading Surah {surah_id}/114...", end="\r")
        try:
            url = f"https://raw.githubusercontent.com/spa5k/tafsir_api/main/tafsir/en-tafisr-ibn-kathir/{surah_id}.json"
            response = urllib.request.urlopen(url)
            data = json.loads(response.read().decode('utf-8'))
            
            for item in data:
                ayah_id = int(item['ayah'])
                content = item['text']
                if content.strip():
                    entries.append((surah_id, ayah_id, 'ibn_kathir', content))
        except Exception as e:
            print(f"\n  Error downloading Surah {surah_id}: {e}")
            
    print("\n  Finished downloading Tafsir Ibn Kathir.")
    return entries

# =====================================================================
# DICTIONARY PARSERS
# =====================================================================

def parse_ibn_faris(filepath):
    """Parses Ibn Faris Maqayis al-Lughah from JSONL."""
    print(f"\nParsing Ibn Faris from {filepath}...")
    if not os.path.exists(filepath):
        print(f"File {filepath} not found. Skipping.")
        return []
        
    entries = []
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            if not line.strip():
                continue
            data = json.loads(line)
            root = data.get('root', '').strip()
            if not root:
                continue
            # Normalize to spaced root letters: "أب" -> "أ ب"
            normalized_root = " ".join(list(root))
            definition = data.get('text', '').strip()
            if definition:
                entries.append((normalized_root, 'ibn_faris', definition))
    return entries

def parse_lisan_al_arab(filepath):
    """Parses Lisan Al Arab from JSONL."""
    print(f"\nParsing Lisan Al Arab from {filepath}...")
    if not os.path.exists(filepath):
        print(f"File {filepath} not found. Skipping.")
        return []
        
    entries = []
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        for line in f:
            if not line.strip():
                continue
            data = json.loads(line)
            headword = data.get('headword', '').strip()
            if not headword:
                continue
            # Normalize to spaced root letters: "أبأ" -> "أ ب أ"
            normalized_root = " ".join(list(headword))
            definition = data.get('text', '').strip()
            if definition:
                entries.append((normalized_root, 'lisan_al_arab', definition))
    return entries

def parse_quranic_usage(filepath):
    """Parses Arabic-English Dictionary of Quranic Usage from text file."""
    print(f"\nParsing Quranic Usage Dictionary from {filepath}...")
    if not os.path.exists(filepath):
        print(f"File {filepath} not found. Skipping.")
        return []
        
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()
        
    # Clean running page headers/numbers to prevent misalignment (e.g. # VERBATIM 1029 و/ص/ي header)
    cleaned_text = re.sub(r'# VERBATIM\s*\n+\s*\d+(?:\s+[\u0621-\u064A/]+)?\s*\n*', '', text)
        
    # Match root dividers like: أ/ب/ب or ب/ر/ق
    # Arabic unicode block is \u0621-\u064A
    pattern = re.compile(r'\n([\u0621-\u064A](?:/[\u0621-\u064A])+)[\s\u00A0]*([^\n]*)')
    matches = list(pattern.finditer(cleaned_text))
    print(f"  Found {len(matches)} root entries.")
    
    entries = []
    for idx in range(len(matches)):
        m = matches[idx]
        raw_root = m.group(1) # e.g. 'أ/ب/ب'
        normalized_root = raw_root.replace('/', ' ') # 'أ/ب/ب' -> 'أ ب ب'
        
        start_pos = m.end()
        end_pos = matches[idx+1].start() if idx+1 < len(matches) else len(cleaned_text)
        
        definition = m.group(2) + "\n" + cleaned_text[start_pos:end_pos].strip()
        if definition.strip():
            entries.append((normalized_root, 'quranic_usage', definition))
            
    return entries

# =====================================================================
# MAIN RUNNER
# =====================================================================

def main():
    init_db()
    conn = get_db_connection()
    
    # Check what is already in the database
    db_counts = {}
    try:
        t_rows = conn.execute("SELECT source_book, COUNT(*) FROM tafsir_entries GROUP BY source_book").fetchall()
        for r in t_rows:
            db_counts[r[0]] = r[1]
        d_rows = conn.execute("SELECT source_book, COUNT(*) FROM dictionary_entries GROUP BY source_book").fetchall()
        for r in d_rows:
            db_counts[r[0]] = r[1]
    except sqlite3.OperationalError:
        pass
    
    # 1. Ingest Dictionaries
    if db_counts.get('ibn_faris', 0) == 0:
        faris_entries = parse_ibn_faris("data/Ibn_Faris_Maqayis.jsonl")
        if faris_entries:
            conn.executemany("""
                INSERT OR REPLACE INTO dictionary_entries (arabic_root_word, source_book, definition)
                VALUES (?, ?, ?)
            """, faris_entries)
            print(f"  Seeded {len(faris_entries)} entries for Ibn Faris.")
    else:
        print("Dictionary 'ibn_faris' already seeded. Skipping.")
        
    if db_counts.get('lisan_al_arab', 0) == 0:
        lisan_entries = parse_lisan_al_arab("data/Lisan_Al_Arab.jsonl")
        if lisan_entries:
            conn.executemany("""
                INSERT OR REPLACE INTO dictionary_entries (arabic_root_word, source_book, definition)
                VALUES (?, ?, ?)
            """, lisan_entries)
            print(f"  Seeded {len(lisan_entries)} entries for Lisan Al Arab.")
    else:
        print("Dictionary 'lisan_al_arab' already seeded. Skipping.")
        
    if db_counts.get('quranic_usage', 0) == 0:
        usage_entries = parse_quranic_usage("data/Quranic_Usage_Dictionary.txt")
        if usage_entries:
            conn.executemany("""
                INSERT OR REPLACE INTO dictionary_entries (arabic_root_word, source_book, definition)
                VALUES (?, ?, ?)
            """, usage_entries)
            print(f"  Seeded {len(usage_entries)} entries for Quranic Usage Dictionary.")
    else:
        print("Dictionary 'quranic_usage' already seeded. Skipping.")
        
    # 2. Ingest Tafseers
    # We wipe the existing Arabic tafseers so they are completely clean
    print("\nWiping existing Arabic Tafseer entries (ibn_ashur, qurtubi)...")
    conn.execute("DELETE FROM tafsir_entries WHERE source_book IN ('ibn_ashur', 'qurtubi')")
    conn.commit()

    ashur_entries = parse_ibn_ashur("data/Ibn_Ashur_Tafsir.txt")
    if ashur_entries:
        conn.executemany("""
            INSERT OR REPLACE INTO tafsir_entries (surah_id, ayah_id, source_book, content)
            VALUES (?, ?, ?, ?)
        """, ashur_entries)
        print(f"  Seeded {len(ashur_entries)} entries for Tafsir Ibn Ashur.")
        
    qurtubi_entries = parse_qurtubi("data/Al_Qurtubi_Tafsir.txt")
    if qurtubi_entries:
        conn.executemany("""
            INSERT OR REPLACE INTO tafsir_entries (surah_id, ayah_id, source_book, content)
            VALUES (?, ?, ?, ?)
        """, qurtubi_entries)
        print(f"  Seeded {len(qurtubi_entries)} entries for Tafsir Al-Qurtubi.")
        
    # Ingest digital Ibn Kathir from GitHub JSON API (conditional)
    if db_counts.get('ibn_kathir', 0) == 0:
        kathir_entries = download_and_parse_kathir()
        if kathir_entries:
            conn.executemany("""
                INSERT OR REPLACE INTO tafsir_entries (surah_id, ayah_id, source_book, content)
                VALUES (?, ?, ?, ?)
            """, kathir_entries)
            print(f"  Seeded {len(kathir_entries)} entries for Tafsir Ibn Kathir (English).")
    else:
        print("Tafsir 'ibn_kathir' already seeded. Skipping download.")
        
    # Build indexes for speed
    print("\nCreating database indexes...")
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_tafsir_lookup ON tafsir_entries (surah_id, ayah_id, source_book);")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_dict_root_lookup ON dictionary_entries (arabic_root_word, source_book);")
    conn.commit()
    
    # Verify counts
    print("\n" + "="*50)
    print("INGESTION COMPLETE. DATABASE STATISTICS:")
    print("="*50)
    
    t_counts = conn.execute("SELECT source_book, COUNT(*) as c FROM tafsir_entries GROUP BY source_book").fetchall()
    for row in t_counts:
        print(f"  Tafsir '{row['source_book']}': {row['c']} entries")
        
    d_counts = conn.execute("SELECT source_book, COUNT(*) as c FROM dictionary_entries GROUP BY source_book").fetchall()
    for row in d_counts:
        print(f"  Dictionary '{row['source_book']}': {row['c']} entries")
        
    conn.close()
    print("\nDatabase file created and seeded at: quran_study.db")

if __name__ == '__main__':
    main()
