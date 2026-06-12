#!/usr/bin/env python3
import os
import re
import sys

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
    "الذاريات": 51, "الطور": 52, "النجم": 53, "القمر": 54,
    "الرحمن": 55, "الواقعة": 56, "الحديد": 57, "المجادلة": 58, "الحشر": 59,
    "الممتحنة": 60, "الصف": 61, "الجمعة": 62, "المنافقون": 63, "التغابن": 64,
    "الطلاق": 65, "التحريم": 66, "الملك": 67, "القلم": 68, "الحاقة": 69,
    "المعارج": 70, "نوح": 71, "الجن": 72, "المزمل": 73, "المدثر": 74,
    "القيامة": 75, "الإنسان": 76, "المرسلات": 77, "النبأ": 78,
    "النازعات": 79, "عبس": 80, "التكوير": 81, "الانفطار": 82, "المطففين": 83,
    "الانشقاق": 84, "البروج": 85, "الطارق": 86, "الأعلى": 87, "الغاشية": 88,
    "الفجر": 89, "البلد": 90, "الشمس": 91, "الليل": 92, "الضحى": 93,
    "الشرح": 94, "التين": 95, "العلق": 96, "القدر": 97,
    "البينة": 98, "الزلزلة": 99, "العاديات": 100, "القارعة": 101, "التكاثر": 102,
    "العصر": 103, "الهمزة": 104, "الفيل": 105, "قريش": 106, "الماعون": 107,
    "الكوثر": 108, "الكافرون": 109, "النصر": 110, "المسد": 111,
    "الإخلاص": 112, "الفلق": 113, "الناس": 114
}

SURAH_ID_TO_NAME = {v: k for k, v in SURAH_ARABIC_NAMES.items()}

def eastern_to_western_num(num_str):
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
    western_str = eastern_to_western_num(ayah_str)
    parts = [x for x in western_str.split('-') if x.strip()]
    if not parts:
        return []
    try:
        numbers = [int(x) for x in parts]
        if len(numbers) == 1:
            return [numbers[0]]
        elif len(numbers) >= 2:
            return list(range(numbers[0], numbers[1] + 1))
    except ValueError:
        pass
    return []

def remove_diacritics(text):
    tashkeel_pattern = re.compile(r'[\u0617-\u061A\u064B-\u0652]')
    return tashkeel_pattern.sub('', text)

def parse_ibn_ashur(filepath):
    print("Testing Ibn Ashur parsing...")
    if not os.path.exists(filepath):
        print(f"File {filepath} not found.")
        return []
        
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        text = f.read()
        
    doc_matches = list(re.finditer(r'START OF (\d+)\.doc', text))
    if not doc_matches:
        print("No START OF doc markers found!")
        return []
        
    entries = []
    for idx, doc in enumerate(doc_matches):
        surah_id = int(doc.group(1))
        start_pos = doc.end()
        end_pos = doc_matches[idx+1].start() if idx+1 < len(doc_matches) else len(text)
        
        surah_text = text[start_pos:end_pos]
        lines = surah_text.splitlines()
        
        verse_headers = []
        for line_idx, line in enumerate(lines):
            line_str = line.strip()
            if re.search(r'\(\d+\)$', line_str) and not re.search(r'\(\d+/\d+\)$', line_str):
                ayah_nums = [int(num) for num in re.findall(r'\((\d+)\)', line_str) if '/' not in num]
                if ayah_nums:
                    verse_headers.append((line_idx, ayah_nums))
                    
        if not verse_headers:
            commentary = surah_text.strip()
            if commentary:
                entries.append((surah_id, 1, 'ibn_ashur', commentary))
            continue
            
        first_header_line, first_ayah_nums = verse_headers[0]
        intro_text = "\n".join(lines[:first_header_line]).strip()
        
        for h_idx, (line_num, ayah_nums) in enumerate(verse_headers):
            c_start = line_num + 1
            c_end = verse_headers[h_idx+1][0] if h_idx+1 < len(verse_headers) else len(lines)
            commentary = "\n".join(lines[c_start:c_end]).strip()
            
            if h_idx == 0 and intro_text:
                commentary = intro_text + "\n\n" + commentary
                
            if commentary:
                for a_id in ayah_nums:
                    entries.append((surah_id, a_id, 'ibn_ashur', commentary))
                    
    print(f"Ibn Ashur parsed: {len(entries)} entries.")
    return entries

def parse_qurtubi(filepath):
    print("Testing Al-Qurtubi parsing...")
    if not os.path.exists(filepath):
        print(f"File {filepath} not found.")
        return []
        
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        text = f.read()
        
    pattern = re.compile(r'\[سورة\s+[^\]]+?\s*\((\d+|[\u0660-\u0669]+)\):\s*آي(?:ة|ات)\s*([^\]]+)\]')
    matches = list(pattern.finditer(text))
    if not matches:
        print("No Qurtubi headers found!")
        return []
        
    grouped_content = {}
    last_ayah_in_surah = {}
    prev_surah_id = 1
    
    for idx, m in enumerate(matches):
        surah_num_str = m.group(1)
        ayah_range_str = m.group(2)
        
        surah_id = int(eastern_to_western_num(surah_num_str))
        ayah_ids = clean_ayah_range(ayah_range_str)
        if not ayah_ids:
            continue
            
        start_pos = m.end()
        end_pos = matches[idx+1].start() if idx+1 < len(matches) else len(text)
        
        commentary = text[start_pos:end_pos].strip()
        if not commentary:
            continue
            
        # Handle Surah Transitions and Introduction split
        if surah_id != prev_surah_id:
            # We split the text before this first match of the new surah
            # The text between the last match's start_pos and current m.start()
            prev_m = matches[idx-1]
            block_between = text[prev_m.end():m.start()].strip()
            
            # Find the split point in the block using the current Surah's name
            surah_name = SURAH_ID_TO_NAME.get(surah_id, "")
            split_idx = -1
            if surah_name:
                norm_block = remove_diacritics(block_between)
                norm_name = remove_diacritics(surah_name)
                # Look for 'سورة [Name]'
                split_match = re.search(r'سورة\s+' + re.escape(norm_name), norm_block)
                if split_match:
                    split_idx = split_match.start()
            
            if split_idx != -1:
                prev_commentary = block_between[:split_idx].strip()
                new_surah_intro = block_between[split_idx:].strip()
                
                # Append the prev_commentary to the previous surah's last ayah
                prev_ayah = last_ayah_in_surah.get(prev_surah_id, 1)
                prev_key = (prev_surah_id, prev_ayah)
                if prev_key in grouped_content:
                    grouped_content[prev_key][-1] += "\n\n" + prev_commentary
                
                # Prepend the intro to the current match's commentary
                commentary = new_surah_intro + "\n\n" + commentary
                
            prev_surah_id = surah_id
            
        # Gap filling logic
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
            
    print(f"Al-Qurtubi parsed: {len(entries)} entries.")
    return entries

def main():
    ashur = parse_ibn_ashur("data/Ibn_Ashur_Tafsir.txt")
    qurtubi = parse_qurtubi("data/Al_Qurtubi_Tafsir.txt")
    
    # Print sample entries for 2:2
    print("\nSample entries for Surah 2, Ayah 2:")
    
    ashur_2_2 = [e for e in ashur if e[0] == 2 and e[1] == 2]
    if ashur_2_2:
        print(f"Ibn Ashur 2:2 content (len={len(ashur_2_2[0][3])}):")
        print(repr(ashur_2_2[0][3][:300]))
    else:
        print("Ibn Ashur 2:2 NOT FOUND!")
        
    qurtubi_2_2 = [e for e in qurtubi if e[0] == 2 and e[1] == 2]
    if qurtubi_2_2:
        print(f"Al-Qurtubi 2:2 content (len={len(qurtubi_2_2[0][3])}):")
        print(repr(qurtubi_2_2[0][3][:300]))
    else:
        print("Al-Qurtubi 2:2 NOT FOUND!")

if __name__ == '__main__':
    main()
