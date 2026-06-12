import { NextRequest, NextResponse } from 'next/server';
import db from '../../lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const surahId = parseInt(searchParams.get('surah_id') || '0', 10);
  const ayahId = parseInt(searchParams.get('ayah_id') || '0', 10);

  if (!surahId || !ayahId) {
    return NextResponse.json({ error: 'Missing surah_id or ayah_id' }, { status: 400 });
  }

  if (!db) {
    return NextResponse.json({ 
      error: 'Database is not available in stateless serverless mode. Please use static offline data.' 
    }, { status: 503 });
  }

  try {
    // Query the static classical I'rab by Qasim Da'as from the database
    const stmt = db.prepare(`
      SELECT content 
      FROM tafsir_entries 
      WHERE surah_id = ? AND ayah_id = ? AND source_book = 'eerab'
    `);
    const row = stmt.get(surahId, ayahId) as { content: string } | undefined;

    if (!row) {
      return NextResponse.json({ error: 'I\'rab not found for this verse in the database.' }, { status: 404 });
    }

    return NextResponse.json({ irab: row.content });

  } catch (error: any) {
    console.error('Database query error:', error);
    return NextResponse.json({ error: error.message || 'Database error' }, { status: 500 });
  }
}
