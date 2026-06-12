#!/usr/bin/env python3
import os
import sys
import json
import sqlite3
import urllib.request
import urllib.parse
import time

DB_PATH = os.path.join(os.path.dirname(__file__), "quran_study.db")
OUTPUT_QURAN_DIR = os.path.join(os.path.dirname(__file__), "mobile", "public", "data", "quran")
OUTPUT_DICT_DIR = os.path.join(os.path.dirname(__file__), "mobile", "public", "data", "dictionary")

def get_db_connection():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database not found at {DB_PATH}")
        sys.exit(1)
    return sqlite3.connect(DB_PATH)

def fetch_json_with_retry(url, retries=3, delay=2):
    for i in range(retries):
        try:
            req = urllib.request.Request(
                url, 
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
            )
            with urllib.request.urlopen(req, timeout=15) as response:
                return json.loads(response.read().decode('utf-8'))
        except Exception as e:
            print(f"  Attempt {i+1} failed: {e}")
            if i < retries - 1:
                time.sleep(delay)
            else:
                raise e

def export_dictionary(db):
    print("\n=== EXPORTING DICTIONARY ENTRIES WITH OCCURRENCES ===")
    cursor = db.cursor()
    cursor.execute("""
        SELECT id, arabic_root_word, source_book, definition, definition_english 
        FROM dictionary_entries 
        WHERE source_book = 'ibn_faris'
    """)
    rows = cursor.fetchall()
    print(f"Found {len(rows)} Ibn Faris root definitions.")
    
    os.makedirs(OUTPUT_DICT_DIR, exist_ok=True)
    
    count = 0
    for row in rows:
        db_id, root, source, arabic_def, english_def = row
        if not root:
            continue
            
        root_clean = root.strip()
        
        # Query occurrences for this root
        cursor.execute("SELECT location FROM word_roots WHERE arabic_root = ?", (root_clean,))
        occ_rows = cursor.fetchall()
        occurrences = sorted(list(set([r[0] for r in occ_rows])))
        
        data = {
            "id": db_id,
            "root": root_clean,
            "source_book": source,
            "definition": arabic_def,
            "definition_english": english_def,
            "occurrences": occurrences
        }
        
        # Save file
        filename = f"{root_clean}.json"
        filepath = os.path.join(OUTPUT_DICT_DIR, filename)
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        count += 1
        
    print(f"Successfully exported {count} dictionary entries to {OUTPUT_DICT_DIR}")

def export_surahs(db):
    print("\n=== EXPORTING QURAN SURAHS WITH MORPHOLOGY ===")
    cursor = db.cursor()
    os.makedirs(OUTPUT_QURAN_DIR, exist_ok=True)

    for surah_id in range(1, 115):
        print(f"Processing Surah {surah_id}/114...")
        
        surah_path = os.path.join(OUTPUT_QURAN_DIR, f"{surah_id}.json")
        if os.path.exists(surah_path):
            try:
                with open(surah_path, "r", encoding="utf-8") as f:
                    surah_data = json.load(f)
                for verse in surah_data.get("verses", []):
                    ayah_id = verse.get("verse_number")
                    # Fetch classical tafseer entries
                    cursor.execute("""
                        SELECT source_book, content 
                        FROM tafsir_entries 
                        WHERE surah_id = ? AND ayah_id = ? AND source_book IN ('saadi', 'ibn_ashur', 'qurtubi', 'ibn_kathir')
                    """, (surah_id, ayah_id))
                    tafsir_rows = cursor.fetchall()
                    verse["tafsirs"] = [
                        {
                            "source_book": r[0],
                            "content": r[1]
                        } for r in tafsir_rows
                    ]
                    
                    # Fetch irab entry (eerab)
                    cursor.execute("""
                        SELECT content 
                        FROM tafsir_entries 
                        WHERE surah_id = ? AND ayah_id = ? AND source_book = 'eerab'
                    """, (surah_id, ayah_id))
                    eerab_row = cursor.fetchone()
                    verse["irab"] = eerab_row[0] if eerab_row else None

                with open(surah_path, "w", encoding="utf-8") as f:
                    json.dump(surah_data, f, ensure_ascii=False, indent=2)
                continue
            except Exception as e:
                print(f"  Local file update failed for Surah {surah_id}, falling back to API: {e}")

        # Fetch Quran.com verses for this Surah
        # per_page=300 ensures we get all verses of any Surah (Surah 2 has 286, which is the maximum)
        api_url = f"https://api.quran.com/api/v4/verses/by_chapter/{surah_id}?words=true&word_fields=text_uthmani,text_imlaei,location&translations=20,85,149&per_page=300"
        
        try:
            api_data = fetch_json_with_retry(api_url)
        except Exception as e:
            print(f"Fatal: Failed to fetch Surah {surah_id} from API: {e}")
            sys.exit(1)
            
        verses = api_data.get("verses", [])
        cleaned_verses = []
        
        for verse in verses:
            verse_key = verse.get("verse_key")
            ayah_id = verse.get("verse_number")
            
            cleaned_verse = {
                "id": verse.get("id"),
                "verse_number": ayah_id,
                "verse_key": verse_key,
                "text_uthmani": verse.get("text_uthmani"),
                "translations": [
                    {
                        "text": t.get("text"),
                        "resource_id": t.get("resource_id")
                    } for t in verse.get("translations", [])
                ],
                "words": []
            }
            
            # Fetch local classical tafseer entries for this verse
            cursor.execute("""
                SELECT source_book, content 
                FROM tafsir_entries 
                WHERE surah_id = ? AND ayah_id = ? AND source_book IN ('saadi', 'ibn_ashur', 'qurtubi', 'ibn_kathir')
            """, (surah_id, ayah_id))
            tafsir_rows = cursor.fetchall()
            cleaned_verse["tafsirs"] = [
                {
                    "source_book": r[0],
                    "content": r[1]
                } for r in tafsir_rows
            ]

            # Fetch irab entry (eerab)
            cursor.execute("""
                SELECT content 
                FROM tafsir_entries 
                WHERE surah_id = ? AND ayah_id = ? AND source_book = 'eerab'
            """, (surah_id, ayah_id))
            eerab_row = cursor.fetchone()
            cleaned_verse["irab"] = eerab_row[0] if eerab_row else None
            
            for word in verse.get("words", []):
                loc = word.get("location")
                char_type = word.get("char_type_name")
                
                cleaned_word = {
                    "id": word.get("id"),
                    "position": word.get("position"),
                    "audio_url": word.get("audio_url"),
                    "char_type_name": char_type,
                    "text_uthmani": word.get("text_uthmani"),
                    "text_imlaei": word.get("text_imlaei"),
                    "location": loc
                }
                
                # Copy translation/transliteration if available
                if word.get("translation"):
                    cleaned_word["translation"] = {
                        "text": word["translation"].get("text"),
                        "language_name": word["translation"].get("language_name")
                    }
                if word.get("transliteration"):
                    cleaned_word["transliteration"] = {
                        "text": word["transliteration"].get("text"),
                        "language_name": word["transliteration"].get("language_name")
                    }
                
                # Fetch local morphology and roots if it's a spoken word
                if char_type == "word" and loc:
                    # 1. Fetch morphology segments
                    cursor.execute("""
                        SELECT part_id, form, tag, features, arabic_root 
                        FROM word_morphology 
                        WHERE location = ? 
                        ORDER BY part_id ASC
                    """, (loc,))
                    morph_rows = cursor.fetchall()
                    
                    cleaned_word["morphology"] = [
                        {
                            "part_id": m[0],
                            "form": m[1],
                            "tag": m[2],
                            "features": m[3],
                            "arabic_root": m[4]
                        } for m in morph_rows
                    ]
                    
                    # 2. Fetch root
                    cursor.execute("""
                        SELECT arabic_root 
                        FROM word_roots 
                        WHERE location = ?
                    """, (loc,))
                    root_row = cursor.fetchone()
                    cleaned_word["root"] = root_row[0] if root_row else None
                else:
                    cleaned_word["morphology"] = []
                    cleaned_word["root"] = None
                    
                cleaned_verse["words"].append(cleaned_word)
                
            cleaned_verses.append(cleaned_verse)
            
        surah_data = {
            "surah_id": surah_id,
            "verses": cleaned_verses
        }
        
        # Save Surah JSON
        surah_path = os.path.join(OUTPUT_QURAN_DIR, f"{surah_id}.json")
        with open(surah_path, "w", encoding="utf-8") as f:
            json.dump(surah_data, f, ensure_ascii=False, indent=2)
            
        # Polite throttle to avoid hitting Quran.com API limits
        time.sleep(0.5)
        
    print(f"Successfully exported all 114 Surahs to {OUTPUT_QURAN_DIR}")

OUTPUT_FORMS_DIR = os.path.join(os.path.dirname(__file__), "mobile", "public", "data", "forms")

def export_forms(db):
    print("\n=== EXPORTING SHARDED WORD FORMS ===")
    cursor = db.cursor()
    cursor.execute("""
        SELECT DISTINCT form, location 
        FROM word_morphology 
        WHERE form IS NOT NULL AND form != ''
    """)
    rows = cursor.fetchall()
    print(f"Found {len(rows)} raw morphology form occurrences.")
    
    os.makedirs(OUTPUT_FORMS_DIR, exist_ok=True)
    
    # Group locations by form
    form_map = {}
    for form, location in rows:
        if not location:
            continue
        form_clean = form.strip()
        if form_clean not in form_map:
            form_map[form_clean] = []
        form_map[form_clean].append(location)
        
    print(f"Grouped into {len(form_map)} unique word forms.")
    
    # Shard into 100 buckets
    shards = [{} for _ in range(100)]
    for form, locations in form_map.items():
        clean_locs = sorted(list(set(locations)))
        shard_idx = sum(ord(c) for c in form) % 100
        shards[shard_idx][form] = clean_locs
        
    # Write shards to JSON files
    for idx, shard in enumerate(shards):
        filepath = os.path.join(OUTPUT_FORMS_DIR, f"shard_{idx}.json")
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(shard, f, ensure_ascii=False, indent=2)
            
    print(f"Successfully exported sharded forms to {OUTPUT_FORMS_DIR}")

def main():
    print("Starting Quranic Study Offline Data Export...")
    start_time = time.time()
    
    db = get_db_connection()
    try:
        export_dictionary(db)
        export_forms(db)
        export_surahs(db)
    finally:
        db.close()
        
    elapsed = time.time() - start_time
    print(f"\nExport completed successfully in {elapsed:.1f}s!")

if __name__ == "__main__":
    main()
