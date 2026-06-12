export interface Word {
  id: number;
  position: number;
  audio_url: string | null;
  char_type_name: string;
  text_uthmani?: string;
  text_imlaei?: string;
  text: string;
  location: string;
  translation: {
    text: string;
    language_name: string;
  };
  transliteration: {
    text: string;
    language_name: string;
  };
  morphology?: MorphPart[];
  root?: string | null;
}

export interface Verse {
  id: number;
  verse_number: number;
  verse_key: string;
  words: Word[];
  translations: Array<{
    id: number;
    resource_id: number;
    text: string;
  }>;
  irab?: string | null;
  tafsirs?: TafseerRow[];
}

export interface TafseerRow {
  source_book: string;
  content: string;
}

export interface MorphPart {
  part_id: number;
  form: string;
  tag: string;
  features: string;
  arabic_root: string | null;
}

export interface LexiconData {
  root: string | null;
  entries: Array<{
    source_book: string;
    definition: string;
    definition_english?: string;
  }>;
  morphology: MorphPart[];
}

export interface Reciter {
  id: string;
  name: string;
  details: string;
}

export interface OccurrenceGroup {
  surahId: number;
  surahName: string;
  ayahs: number[];
}
