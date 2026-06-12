import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import db from '../../lib/db';

async function translateIbnFaris(rootWord: string, arabicDefinition: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not configured. Returning original Arabic.");
    return "";
  }
  
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    let model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const prompt = `
You are an expert academic translator of classical Arabic lexicography.
Your task is to translate the following dictionary entry from "Maqayis al-Lughah" by Ibn Faris for the Arabic root "${rootWord}" into English.

Here is the original Arabic text:
"""
${arabicDefinition}
"""

Please apply the following translation rules:
1. Translate the text faithfully and concisely. Avoid adding excessive external commentary or long explanations.
2. When a Quranic verse or pre-Islamic poem is quoted, translate it and add a very brief parenthetical explanation (1-2 sentences max) showing how it relates to the root word's meaning.
3. Structure your output exactly as follows:
### Core Semantic Principles
[A brief 1-2 sentence summary of the core origin(s)/meaning(s) established for the root.]

### Derivations & Evidence
[A bulleted list translating the derivations, examples, verses, or poetry cited in the entry. Keep the explanations concise.]

4. Maintain readability. Use bolding for terms and transliterations in italics (e.g. *al-Abb*). Do not leave untranslated Arabic in the English text.
`;
    
    let result;
    try {
      result = await model.generateContent(prompt);
    } catch (apiErr) {
      console.warn("gemini-2.5-flash translation failed, trying gemini-1.5-flash:", apiErr);
      model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      result = await model.generateContent(prompt);
    }
    return result.response.text();
  } catch (err) {
    console.error("Error calling Gemini API for dictionary translation:", err);
    return "";
  }
}

async function getTranslatedDictionaryEntries(rootWord: string): Promise<any[]> {
  if (!db) return [];
  
  const dictStmt = db.prepare(`
    SELECT id, source_book, definition, definition_english 
    FROM dictionary_entries 
    WHERE arabic_root_word = ?
  `);
  const rows = dictStmt.all(rootWord) as any[];
  const processedRows = [];

  for (const row of rows) {
    if (row.source_book === 'ibn_faris' && !row.definition_english) {
      console.log(`Translating Ibn Faris definition for root: ${rootWord}`);
      const translation = await translateIbnFaris(rootWord, row.definition);
      if (translation) {
        row.definition_english = translation;
        // Save to database
        try {
          const updateStmt = db.prepare('UPDATE dictionary_entries SET definition_english = ? WHERE id = ?');
          updateStmt.run(translation, row.id);
          console.log(`Successfully saved translated Ibn Faris for root ${rootWord} to database.`);
        } catch (dbErr) {
          console.error("Error writing dictionary translation to database:", dbErr);
        }
      }
    }
    processedRows.push(row);
  }

  return processedRows;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const type = body.type;

    if (type === 'translate_root') {
      const rootWord = body.root;
      const definition = body.definition;

      if (!rootWord || !definition) {
        return NextResponse.json({ error: 'Missing root or definition' }, { status: 400 });
      }

      console.log(`Translating dictionary entry stateless for root: ${rootWord}`);
      const translation = await translateIbnFaris(rootWord, definition);

      // Save to database if available
      if (db && translation) {
        try {
          const updateStmt = db.prepare('UPDATE dictionary_entries SET definition_english = ? WHERE arabic_root_word = ? AND source_book = \'ibn_faris\'');
          updateStmt.run(translation, rootWord);
          console.log(`Saved dictionary translation of ${rootWord} to database cache.`);
        } catch (dbErr) {
          console.error("Error writing dictionary translation to database:", dbErr);
        }
      }

      return NextResponse.json({ definition_english: translation });
    }

    return NextResponse.json({ error: 'Invalid POST query type' }, { status: 400 });
  } catch (error: any) {
    console.error('Stateless translation error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  if (!db) {
    return NextResponse.json({ error: 'Database is not available in stateless serverless mode. Please use POST.' }, { status: 503 });
  }

  try {
    if (type === 'tafsir') {
      const surahId = parseInt(searchParams.get('surah_id') || '0', 10);
      const ayahId = parseInt(searchParams.get('ayah_id') || '0', 10);

      if (!surahId || !ayahId) {
        return NextResponse.json({ error: 'Missing surah_id or ayah_id' }, { status: 400 });
      }

      // Query Tafseer entries
      const stmt = db.prepare(`
        SELECT source_book, content 
        FROM tafsir_entries 
        WHERE surah_id = ? AND ayah_id = ?
      `);
      const rows = stmt.all(surahId, ayahId);
      return NextResponse.json({ tafsirs: rows });

    } else if (type === 'root') {
      const location = searchParams.get('location'); // e.g. "1:2:1"
      if (!location) {
        return NextResponse.json({ error: 'Missing location' }, { status: 400 });
      }

      // 1. Get root word from word_roots
      const rootStmt = db.prepare('SELECT arabic_root FROM word_roots WHERE location = ?');
      const rootRow = rootStmt.get(location) as { arabic_root: string } | undefined;

      // 2. Get morphology breakdown for the word
      const morphStmt = db.prepare(`
        SELECT part_id, form, tag, features, arabic_root 
        FROM word_morphology 
        WHERE location = ? 
        ORDER BY part_id ASC
      `);
      const morphRows = morphStmt.all(location);

      const rootWord = rootRow?.arabic_root || null;
      let dictRows: any[] = [];

      if (rootWord) {
        dictRows = await getTranslatedDictionaryEntries(rootWord);
      }

      return NextResponse.json({
        root: rootWord,
        entries: dictRows,
        morphology: morphRows
      });

    } else if (type === 'lexicon') {
      const rootWord = searchParams.get('root');
      if (!rootWord) {
        return NextResponse.json({ error: 'Missing root' }, { status: 400 });
      }

      const dictRows = await getTranslatedDictionaryEntries(rootWord);

      return NextResponse.json({
        root: rootWord,
        entries: dictRows
      });

    } else if (type === 'occurrences') {
      const rootWord = searchParams.get('root') || '';
      const form = searchParams.get('form') || '';

      if (!rootWord && !form) {
        return NextResponse.json({ error: 'Missing root or form' }, { status: 400 });
      }

      let rootLocations: any[] = [];
      let formLocations: any[] = [];

      if (rootWord) {
        const stmt = db.prepare('SELECT location FROM word_roots WHERE arabic_root = ?');
        rootLocations = stmt.all(rootWord);
      }

      if (form) {
        const stmt = db.prepare('SELECT DISTINCT location FROM word_morphology WHERE form = ?');
        formLocations = stmt.all(form);
      }

      return NextResponse.json({
        root: rootWord,
        form: form,
        rootOccurrences: rootLocations.map(r => r.location),
        formOccurrences: formLocations.map(r => r.location)
      });

    } else {
      return NextResponse.json({ error: 'Invalid query type' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Database query error:', error);
    return NextResponse.json({ error: error.message || 'Database error' }, { status: 500 });
  }
}
