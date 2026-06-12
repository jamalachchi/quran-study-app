-- schema.sql
-- SQLite database schema for Quranic Study application

-- 1. Tafseer Table
CREATE TABLE IF NOT EXISTS tafsir_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    surah_id INTEGER NOT NULL,
    ayah_id INTEGER NOT NULL,
    source_book TEXT NOT NULL, -- 'ibn_kathir', 'ibn_ashur', 'qurtubi'
    content TEXT NOT NULL
);

-- Unique index to prevent duplicate entries and speed up lookups by Surah, Ayah and Book
CREATE UNIQUE INDEX IF NOT EXISTS idx_tafsir_lookup 
ON tafsir_entries (surah_id, ayah_id, source_book);

-- 2. Dictionaries Table
CREATE TABLE IF NOT EXISTS dictionary_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    arabic_root_word TEXT NOT NULL, -- e.g. 'ك ت ب' or 'كتب'
    source_book TEXT NOT NULL, -- 'ibn_faris', 'lisan_al_arab', 'quranic_usage'
    definition TEXT NOT NULL
);

-- Index for root-word lookup
CREATE INDEX IF NOT EXISTS idx_dict_root_lookup 
ON dictionary_entries (arabic_root_word, source_book);

-- 3. AI Exegesis Summaries Cache Table
CREATE TABLE IF NOT EXISTS cached_ai_summaries (
    surah_id INTEGER NOT NULL,
    ayah_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (surah_id, ayah_id)
);

