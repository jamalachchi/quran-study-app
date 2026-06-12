import sqlite3
import json
import os

def export_summaries():
    db_path = "quran_study.db"
    export_dir = "mobile/public/data/ai_summaries"
    
    if not os.path.exists(db_path):
        print(f"Error: Database file not found at {db_path}")
        return
        
    os.makedirs(export_dir, exist_ok=True)
    
    print(f"Connecting to database {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='cached_ai_summaries'")
        if not cursor.fetchone():
            print("Error: Table 'cached_ai_summaries' does not exist in the database yet. Run the app and generate a summary first!")
            return
            
        cursor.execute("SELECT surah_id, ayah_id, content FROM cached_ai_summaries")
        rows = cursor.fetchall()
        
        print(f"Found {len(rows)} cached summaries to export.")
        
        count = 0
        for surah_id, ayah_id, content in rows:
            data = {
                "surah_id": surah_id,
                "ayah_id": ayah_id,
                "summary": content
            }
            
            file_name = f"{surah_id}_{ayah_id}.json"
            file_path = os.path.join(export_dir, file_name)
            
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                
            count += 1
            
        print(f"Success: Exported {count} AI exegesis summaries to {export_dir}/")
        
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    export_summaries()
