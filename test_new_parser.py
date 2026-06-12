#!/usr/bin/env python3
import os
import re

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
    range_match = re.split(r'إلى|الى|-', western_str)
    if len(range_match) >= 2:
        start_nums = re.findall(r'\d+', range_match[0])
        end_nums = re.findall(r'\d+', range_match[1])
        if start_nums and end_nums:
            start = int(start_nums[0])
            end = int(end_nums[0])
            if start <= end:
                return list(range(start, end + 1))
            else:
                return list(range(end, start + 1))
    
    nums = [int(n) for n in re.findall(r'\d+', western_str)]
    return nums

def make_diacritic_regex(word):
    tashkeel_regex = r'[\u0617-\u061A\u064B-\u0652]*'
    parts = []
    for char in word:
        if char == ' ':
            parts.append(r'\s+')
        else:
            parts.append(re.escape(char) + tashkeel_regex)
    return ''.join(parts)

def parse_ibn_ashur(filepath):
    print("Parsing Ibn Ashur...")
    if not os.path.exists(filepath):
        print(f"File {filepath} not found.")
        return []
        
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        text = f.read()
        
    lines = text.splitlines()
    
    # First, scan and find all verse headers
    verse_headers = []
    for idx, line in enumerate(lines):
        line_str = line.strip()
        if re.search(r'\(\d+\)$', line_str) and not re.search(r'\(\d+/\d+\)$', line_str):
            nums = [int(num) for num in re.findall(r'\((\d+)\)', line_str) if '/' not in num]
            if nums:
                verse_headers.append((idx, nums, line_str))
                
    print(f"Found {len(verse_headers)} verse headers in Ibn Ashur.")
    
    # Trace surah_id and build entries
    entries = []
    surah_id = 0
    
    for h_idx, (line_num, nums, header_text) in enumerate(verse_headers):
        # Determine surah transition
        if 1 in nums:
            surah_id += 1
            
        c_start = line_num + 1
        c_end = verse_headers[h_idx+1][0] if h_idx+1 < len(verse_headers) else len(lines)
        
        # Build commentary text
        commentary_lines = []
        for l_idx in range(c_start, c_end):
            l_str = lines[l_idx].strip()
            # Clean out metadata/page lines
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
                
    print(f"Ibn Ashur parsed: {len(entries)} entries. Max Surah ID reached: {surah_id}")
    return entries

def parse_qurtubi(filepath):
    print("Parsing Al-Qurtubi...")
    if not os.path.exists(filepath):
        print(f"File {filepath} not found.")
        return []
        
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        text = f.read()
        
    # Regex: matches [سورة Name (Num): VerseRange]
    pattern = re.compile(r'\[سورة\s+([^\(]+?)\s*\((\d+|[\u0660-\u0669]+)\):\s*([^\]]+)\]')
    matches = list(pattern.finditer(text))
    if not matches:
        print("No Qurtubi headers found!")
        return []
        
    print(f"Found {len(matches)} verse headers in Al-Qurtubi.")
    
    grouped_content = {}
    last_ayah_in_surah = {}
    prev_surah_id = 1
    
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
                regex_str = make_diacritic_regex('سورة ' + surah_name)
                split_match = re.search(regex_str, block_between)
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
            
    print(f"Al-Qurtubi parsed: {len(entries)} entries. Max Surah ID reached: {max([e[0] for e in entries]) if entries else 0}")
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
