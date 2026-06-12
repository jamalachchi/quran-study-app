import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import db from '../../lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const surahId = parseInt(body.surah_id || '0', 10);
    const ayahId = parseInt(body.ayah_id || '0', 10);
    const verseText = body.verse_text || '';
    let ibnAshurContent = body.ibn_ashur || '';
    let qurtubiContent = body.qurtubi || '';

    if (!surahId || !ayahId) {
      return NextResponse.json({ error: 'Missing surah_id or ayah_id' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'GEMINI_API_KEY is not configured. Please set the GEMINI_API_KEY environment variable.' 
      }, { status: 500 });
    }

    // 0. Check cache if DB is available
    if (db) {
      try {
        const cacheStmt = db.prepare('SELECT content FROM cached_ai_summaries WHERE surah_id = ? AND ayah_id = ?');
        const cachedRow = cacheStmt.get(surahId, ayahId) as { content: string } | undefined;
        if (cachedRow) {
          console.log(`Loading cached exegesis for Surah ${surahId}, Ayah ${ayahId} from database.`);
          return NextResponse.json({ summary: cachedRow.content });
        }
      } catch (e) {
        console.warn("Failed to check database cache:", e);
      }
    }

    // 1. Fetch from DB if content was not sent by client and DB is available
    if (!ibnAshurContent && !qurtubiContent && db) {
      try {
        const stmt = db.prepare(`
          SELECT source_book, content 
          FROM tafsir_entries 
          WHERE surah_id = ? AND ayah_id = ? AND source_book IN ('ibn_ashur', 'qurtubi')
        `);
        const rows = stmt.all(surahId, ayahId) as Array<{ source_book: string, content: string }>;
        ibnAshurContent = rows.find(r => r.source_book === 'ibn_ashur')?.content || '';
        qurtubiContent = rows.find(r => r.source_book === 'qurtubi')?.content || '';
      } catch (e) {
        console.warn("Failed to query database for source tafseers:", e);
      }
    }

    // If both are empty, we can't summarize
    if (!ibnAshurContent && !qurtubiContent) {
      return NextResponse.json({ 
        summary: `### Integrated summary\n\nNOT_FOUND\n\nSource note: Neither of the requested source traditions (Ibn Ashur or Al-Qurtubi) was found in the database or provided by the client for Surah ${surahId}, Ayah ${ayahId}.` 
      });
    }

    // 2. Initialize Gemini API Client
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // 3. Construct prompt
    const prompt = `
You are helping me study Qur'an tafsir for specific chapter-and-verse references.
Your job is to produce a careful, comprehensive, source-disciplined summary of the requested verse(s) based exclusively on the provided Arabic Tafsir texts:
- Al-Tahrir wa al-Tanwir (Ibn Ashur)
- Tafsir al-Qurtubi

Here is the context of the verse:
Reference: Surah ${surahId}, Ayah ${ayahId}
Arabic Verse Text: ${verseText || '(not provided)'}

Here is the Tafsir text of Al-Tahrir wa al-Tanwir (Ibn Ashur) for this verse:
"""
${ibnAshurContent || 'NOT FOUND IN AVAILABLE FILES'}
"""

Here is the Tafsir text of Tafsir al-Qurtubi for this verse:
"""
${qurtubiContent || 'NOT FOUND IN AVAILABLE FILES'}
"""

Please apply the following rules:
- Produce a comprehensive, integrated English summary based on those materials.
- Your summary must be based on what these texts actually discuss for that verse (plain meaning, lexical points, rhetorical/stylistic observations, theological/legal points, debates, readings).
- Be selective but thorough.
- Do NOT present an interpretation as being in the source unless it is actually supported by the source text.
- Do NOT smooth over genuine differences between Qurtubi and Ibn Ashur.
- If one source is missing, write the integrated summary based on the other source, and write a Source Note: "Source note: One of the two requested source traditions was NOT FOUND in the available Project files for this passage."
- If neither is found, output: "NOT_FOUND" for that reference. Do not guess or pad.
- Within the integrated summary, do NOT use bullet points or split the passage into subsections like "Qurtubi says" and "Ibn Ashur says". It should be continuous exegetical prose.
- You may add a short final paragraph titled "Reflection:" but ONLY if it grows naturally out of the themes of the verse and remains brief and non-speculative.

Structure your response exactly as follows:
### Integrated summary
[Your integrated summary here]

[Optional Reflection section here starting with "Reflection:"]
`;

    let summaryText = '';
    let lastError: any = null;
    const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash'];

    for (const modelName of modelsToTry) {
      try {
        console.log(`Attempting exegesis synthesis with ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        summaryText = result.response.text();
        if (summaryText) {
          lastError = null;
          break;
        }
      } catch (err: any) {
        console.warn(`${modelName} call failed, trying next available model:`, err.message || err);
        lastError = err;
      }
    }

    if (lastError) {
      throw lastError;
    }

    // Save to DB cache if DB is available and writeable
    if (db) {
      try {
        const insertStmt = db.prepare('INSERT OR REPLACE INTO cached_ai_summaries (surah_id, ayah_id, content) VALUES (?, ?, ?)');
        insertStmt.run(surahId, ayahId, summaryText);
        console.log(`Saved newly generated exegesis for Surah ${surahId}, Ayah ${ayahId} to database cache.`);
      } catch (dbErr) {
        console.error("Failed to save summary to database cache:", dbErr);
      }
    }

    return NextResponse.json({ summary: summaryText });

  } catch (error: any) {
    console.error('Gemini summary generation error:', error);
    return NextResponse.json({ error: error.message || 'Error generating summary' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const surahId = parseInt(searchParams.get('surah_id') || '0', 10);
  const ayahId = parseInt(searchParams.get('ayah_id') || '0', 10);
  const verseText = searchParams.get('verse_text') || '';

  if (!surahId || !ayahId) {
    return NextResponse.json({ error: 'Missing surah_id or ayah_id' }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ 
      error: 'GEMINI_API_KEY is not configured. Please set the GEMINI_API_KEY environment variable.' 
    }, { status: 500 });
  }

  // Fallback GET execution (only works if DB is available)
  if (!db) {
    return NextResponse.json({ 
      error: 'Database is not available for GET requests on this serverless environment. Please use POST.' 
    }, { status: 503 });
  }

  try {
    const cacheStmt = db.prepare('SELECT content FROM cached_ai_summaries WHERE surah_id = ? AND ayah_id = ?');
    const cachedRow = cacheStmt.get(surahId, ayahId) as { content: string } | undefined;
    if (cachedRow) {
      return NextResponse.json({ summary: cachedRow.content });
    }

    const stmt = db.prepare(`
      SELECT source_book, content 
      FROM tafsir_entries 
      WHERE surah_id = ? AND ayah_id = ? AND source_book IN ('ibn_ashur', 'qurtubi')
    `);
    const rows = stmt.all(surahId, ayahId) as Array<{ source_book: string, content: string }>;

    const ibnAshurContent = rows.find(r => r.source_book === 'ibn_ashur')?.content || '';
    const qurtubiContent = rows.find(r => r.source_book === 'qurtubi')?.content || '';

    if (!ibnAshurContent && !qurtubiContent) {
      return NextResponse.json({ 
        summary: `### Integrated summary\n\nNOT_FOUND\n\nSource note: Neither of the requested source traditions was found.` 
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const prompt = `
You are helping me study Qur'an tafsir for specific chapter-and-verse references.
Your job is to produce a careful, comprehensive, source-disciplined summary of the requested verse(s) based exclusively on the provided Arabic Tafsir texts.

Reference: Surah ${surahId}, Ayah ${ayahId}
Arabic Verse Text: ${verseText || '(not provided)'}

Al-Tahrir wa al-Tanwir (Ibn Ashur):
${ibnAshurContent}

Tafsir al-Qurtubi:
${qurtubiContent}
`;

    let summaryText = '';
    let lastError: any = null;
    const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash'];

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        summaryText = result.response.text();
        if (summaryText) {
          lastError = null;
          break;
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    if (lastError) throw lastError;

    try {
      const insertStmt = db.prepare('INSERT OR REPLACE INTO cached_ai_summaries (surah_id, ayah_id, content) VALUES (?, ?, ?)');
      insertStmt.run(surahId, ayahId, summaryText);
    } catch (dbErr) {}

    return NextResponse.json({ summary: summaryText });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error generating summary' }, { status: 500 });
  }
}
