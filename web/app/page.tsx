"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CHAPTERS, Chapter } from "./lib/chapters";
import Link from "next/link";

interface Word {
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
}

interface Verse {
  id: number;
  verse_number: number;
  verse_key: string;
  words: Word[];
  translations: Array<{
    id: number;
    resource_id: number;
    text: string;
  }>;
}

interface TafseerRow {
  source_book: string;
  content: string;
}

interface MorphPart {
  part_id: number;
  form: string;
  tag: string;
  features: string;
  arabic_root: string | null;
}

interface LexiconData {
  root: string | null;
  entries: Array<{
    source_book: string;
    definition: string;
    definition_english?: string;
  }>;
  morphology: MorphPart[];
}

const RECITERS = [
  { id: "Husary_64kbps", name: "Mahmoud Al-Husary (Murattal)", details: "Mahmoud Khalil Al-Husary (Murattal)" },
  { id: "Husary_128kbps_Mujawwad", name: "Mahmoud Al-Husary (Mujawwad)", details: "Mahmoud Khalil Al-Husary (Mujawwad)" },
  { id: "Husary_Muallim_128kbps", name: "Mahmoud Al-Husary (Muallim)", details: "Mahmoud Khalil Al-Husary (Muallim)" },
  { id: "Minshawy_Murattal_128kbps", name: "Mohamed Al-Minshawi (Murattal)", details: "Mohamed Siddiq Al-Minshawi (Murattal)" },
  { id: "Abdul_Basit_Murattal_64kbps", name: "Abdul Basit (Murattal)", details: "Abdul Basit Abdul Samad (Murattal)" },
  { id: "Abdul_Basit_Mujawwad_128kbps", name: "Abdul Basit (Mujawwad)", details: "Abdul Basit Abdul Samad (Mujawwad)" },
  { id: "Alafasy_128kbps", name: "Mishary Alafasy", details: "Mishary Rashid Alafasy" },
  { id: "Ghamadi_40kbps", name: "Saad Al-Ghamdi", details: "Saad Al-Ghamdi" },
  { id: "Abdurrahmaan_As-Sudais_192kbps", name: "Abdurrahman Al-Sudais", details: "Abdurrahman Al-Sudais" },
];

const PART_OF_SPEECH_MAP: Record<string, string> = {
  N: "Noun (إسم)",
  PN: "Proper Noun (اسم علم)",
  PRON: "Personal Pronoun (ضمير)",
  DEM: "Demonstrative Pronoun (اسم إشارة)",
  REL: "Relative Pronoun (اسم موصول)",
  ADJ: "Adjective (صفة)",
  V: "Verb (فعل)",
  P: "Preposition (حرف جر)",
  CONJ: "Conjunction (حرف عطف)",
  DET: "Determiner (Definite Article الـ)",
  NEG: "Negative Particle (حرف نفي)",
  NUM: "Numeral (عدد)",
  T: "Time Adverb (ظرف زمان)",
  LOC: "Location Adverb (ظرف مكان)",
  INTG: "Interrogative Particle (حرف استفهام)",
  VOC: "Vocative Particle (حرف نداء)",
  ACC: "Accusative Particle (حرف نصب)",
  SUB: "Subordinating Conjunction (حرف مصدري)",
  COND: "Conditional Particle (حرف شرط)",
  EMPH: "Emphatic Lām (لام التوكيد)",
  IMPV: "Imperative Lām (لام الأمر)",
  PRP: "Purpose Lām (لام التعليل)",
  FUT: "Future Particle (حرف استقبال)",
  PREV: "Preventive Particle (حرف كافّ)",
  INC: "Inceptive Particle (حرف ابتداء)",
  EXH: "Exhortation Particle (حرف تحضيض)",
  EXP: "Explanation Particle (حرف تفسير)",
  RET: "Restrictive Particle (حرف حصر)",
  RES: "Resumption Particle (حرف استئناف)",
  COM: "Comitative Particle (واو المعية)",
  EQ: "Equative Particle (همزة التسوية)",
  SUR: "Surprise Particle (حرف فجاءة)"
};

const FEATURE_EXPLANATIONS: Record<string, { label: string; desc: string }> = {
  M: { label: "Gender", desc: "Masculine (مذكر)" },
  F: { label: "Gender", desc: "Feminine (مؤنث)" },
  S: { label: "Number", desc: "Singular (مفرد)" },
  D: { label: "Number", desc: "Dual (مثنى)" },
  P: { label: "Number", desc: "Plural (جمع)" },
  "1": { label: "Person", desc: "1st Person (أنا/نحن)" },
  "2": { label: "Person", desc: "2nd Person (مخاطب)" },
  "3": { label: "Person", desc: "3rd Person (غائب)" },
  NOM: { label: "Case/Mood", desc: "Nominative / Marfoo' (مرفوع)" },
  ACC: { label: "Case/Mood", desc: "Accusative / Mansoob (منصوب)" },
  GEN: { label: "Case", desc: "Genitive / Majroor (مجرور)" },
  DEF: { label: "State", desc: "Definite (معرفة)" },
  INDEF: { label: "State", desc: "Indefinite (نكرة)" },
  PERF: { label: "Verb Aspect", desc: "Past Tense / Perfect (فعل ماض)" },
  IMPF: { label: "Verb Aspect", desc: "Present Tense / Imperfect (فعل مضارع)" },
  IMPR: { label: "Verb Mood", desc: "Imperative / Command (فعل أمر)" },
  ACT: { label: "Voice", desc: "Active Voice (مبني للمعلوم)" },
  PASS: { label: "Voice", desc: "Passive Voice (مبني للمجهول)" },
  PCPL: { label: "Form", desc: "Participle (اسم فاعل/مفعول)" },
  VN: { label: "Form", desc: "Verbal Noun (مصدر)" }
};

function parseFeatureString(featuresStr: string, tag: string) {
  const parts = featuresStr.split('|');
  const explanations: Array<{ label: string; value: string }> = [];

  const friendlyTag = PART_OF_SPEECH_MAP[tag] || tag;
  explanations.push({ label: "Part of Speech", value: friendlyTag });

  for (const part of parts) {
    if (part === "STEM" || part === "PREFIX" || part === "SUFFIX") {
      explanations.push({ label: "Segment Type", value: part === "STEM" ? "Stem (أصل الكلمة)" : part === "PREFIX" ? "Prefix (سابقة)" : "Suffix (لاحقة)" });
      continue;
    }
    if (part.startsWith("POS:")) continue;
    if (part.startsWith("LEM:")) {
      explanations.push({ label: "Lemma", value: part.substring(4) });
      continue;
    }
    if (part.startsWith("ROOT:")) {
      explanations.push({ label: "Root letters", value: part.substring(5).split('').join(' ') });
      continue;
    }
    if (part.startsWith("PRON:")) {
      const pronCode = part.substring(5);
      let desc = pronCode;
      if (pronCode === "3MS") desc = "3rd Person Masculine Singular (هو)";
      else if (pronCode === "3FS") desc = "3rd Person Feminine Singular (هي)";
      else if (pronCode === "2MS") desc = "2nd Person Masculine Singular (أنت)";
      else if (pronCode === "1S") desc = "1st Person Singular (أنا)";
      else if (pronCode === "3MP") desc = "3rd Person Masculine Plural (هم)";
      else if (pronCode === "2MP") desc = "2nd Person Masculine Plural (أنتم)";
      else if (pronCode === "1P") desc = "1st Person Plural (نحن)";
      explanations.push({ label: "Pronoun Reference", value: desc });
      continue;
    }
    if (part.startsWith("SP:")) {
      explanations.push({ label: "Syntactic Role", value: `Subject of ${part.substring(3)}` });
      continue;
    }

    if (FEATURE_EXPLANATIONS[part]) {
      const info = FEATURE_EXPLANATIONS[part];
      explanations.push({ label: info.label, value: info.desc });
    }
  }

  return explanations;
}

interface OccurrenceGroup {
  surahId: number;
  surahName: string;
  ayahs: number[];
}

const groupOccurrences = (locations: string[]): OccurrenceGroup[] => {
  const groups: Record<number, number[]> = {};
  
  locations.forEach(loc => {
    const [s, a] = loc.split(':').map(Number);
    if (!groups[s]) {
      groups[s] = [];
    }
    if (!groups[s].includes(a)) {
      groups[s].push(a);
    }
  });

  return Object.keys(groups)
    .map(Number)
    .sort((a, b) => a - b)
    .map(sId => {
      const ch = CHAPTERS.find(c => c.id === sId);
      return {
        surahId: sId,
        surahName: ch ? ch.name_simple : `Surah ${sId}`,
        ayahs: groups[sId].sort((a, b) => a - b)
      };
    });
};

export default function Home() {
  const [selectedSurah, setSelectedSurah] = useState<number>(1);
  const [selectedAyah, setSelectedAyah] = useState<number>(1);
  const [ayahCount, setAyahCount] = useState<number>(7);

  // Data states
  const [verseData, setVerseData] = useState<Verse | null>(null);
  const [verseLoading, setVerseLoading] = useState<boolean>(true);
  const [verseError, setVerseError] = useState<string>("");

  const [tafsirs, setTafsirs] = useState<TafseerRow[]>([]);
  const [tafsirsLoading, setTafsirsLoading] = useState<boolean>(true);

  // Interactive word states
  const [clickedWord, setClickedWord] = useState<Word | null>(null);
  const [wordData, setWordData] = useState<LexiconData | null>(null);
  const [wordLoading, setWordLoading] = useState<boolean>(false);

  // Vocabulary & Toast states
  const [savedCount, setSavedCount] = useState<number>(0);
  const [toasts, setToasts] = useState<Array<{ id: number; arabic: string; translation: string }>>([]);

  // Load vocabulary count on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("al_bayan_vocabulary");
        if (stored) {
          const list = JSON.parse(stored);
          setSavedCount(list.length);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const addToast = (arabic: string, translation: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, arabic, translation }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const saveWordToVocabulary = (word: Word, lexiconData: LexiconData | null) => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem("al_bayan_vocabulary");
      const list: any[] = stored ? JSON.parse(stored) : [];
      
      const exists = list.some((item) => item.id === word.location);
      if (exists) return; // Word already saved
      
      let primaryDefinition = null;
      if (lexiconData && lexiconData.entries && lexiconData.entries.length > 0) {
        const englishEntry = lexiconData.entries.find(
          (e) => e.source_book === "quranic_usage" || e.definition_english
        );
        primaryDefinition = englishEntry 
          ? (englishEntry.definition_english || englishEntry.definition)
          : lexiconData.entries[0].definition;
      }
      
      const newItem = {
        id: word.location,
        surahId: selectedSurah,
        ayahId: selectedAyah,
        wordIndex: word.position,
        text_uthmani: word.text_uthmani || word.text,
        translation: word.translation.text,
        transliteration: word.transliteration.text,
        root: lexiconData?.root || null,
        definition: primaryDefinition || null,
        savedAt: Date.now(),
      };
      
      list.push(newItem);
      localStorage.setItem("al_bayan_vocabulary", JSON.stringify(list));
      setSavedCount(list.length);
      addToast(word.text_uthmani || word.text, word.translation.text);
    } catch (e) {
      console.error("Failed to save word to vocabulary:", e);
    }
  };

  // Gemini AI states
  const [geminiSummary, setGeminiSummary] = useState<string>("");
  const [geminiLoading, setGeminiLoading] = useState<boolean>(false);
  const [geminiError, setGeminiError] = useState<string>("");

  // Full-verse I'rab states
  const [irabText, setIrabText] = useState<string>("");
  const [irabLoading, setIrabLoading] = useState<boolean>(false);
  const [irabError, setIrabError] = useState<string>("");
  const [isIrabOpen, setIsIrabOpen] = useState<boolean>(false);
  const [activeIrabTab, setActiveIrabTab] = useState<"full" | "word">("full");

  // Concordance/occurrences states
  const [concordanceData, setConcordanceData] = useState<{
    root: string;
    form: string;
    rootOccurrences: string[];
    formOccurrences: string[];
  } | null>(null);
  const [concordanceLoading, setConcordanceLoading] = useState<boolean>(false);
  const [activeConcordanceTab, setActiveConcordanceTab] = useState<"root" | "form">("root");

  // Audio recitation states
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingFullAudio, setIsPlayingFullAudio] = useState<boolean>(false);
  const [selectedReciter, setSelectedReciter] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("selectedReciter") || "Husary_64kbps";
    }
    return "Husary_64kbps";
  });

  // Persist reciter preference
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("selectedReciter", selectedReciter);
    }
  }, [selectedReciter]);

  // Handle reciter change during active playback
  useEffect(() => {
    if (isPlayingFullAudio && audioRef.current) {
      audioRef.current.pause();

      const pad = (num: number, size: number) => {
        let s = num + "";
        while (s.length < size) s = "0" + s;
        return s;
      };
      const audioUrl = `https://mirrors.quranicaudio.com/everyayah/${selectedReciter}/${pad(selectedSurah, 3)}${pad(selectedAyah, 3)}.mp3`;

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.play().catch((e) => {
        console.error("Failed to transition recitation audio", e);
        setIsPlayingFullAudio(false);
      });

      audio.onended = () => {
        setIsPlayingFullAudio(false);
      };
    }
  }, [selectedReciter, selectedSurah, selectedAyah, isPlayingFullAudio]);

  // Update verse list length when Surah changes
  useEffect(() => {
    const chapter = CHAPTERS.find((c) => c.id === selectedSurah);
    if (chapter) {
      setAyahCount(chapter.verses_count);
      // Ensure selectedAyah is within bounds
      if (selectedAyah > chapter.verses_count) {
        setSelectedAyah(1);
      }
    }
  }, [selectedSurah]);

  // Load Surah and Ayah from URL search params on mount if available
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const params = new URLSearchParams(window.location.search);
        const s = params.get("surah");
        const a = params.get("ayah");
        if (s) {
          const surahId = parseInt(s, 10);
          if (surahId >= 1 && surahId <= 114) {
            setSelectedSurah(surahId);
            if (a) {
              const ayahId = parseInt(a, 10);
              const chapter = CHAPTERS.find((c) => c.id === surahId);
              if (chapter && ayahId >= 1 && ayahId <= chapter.verses_count) {
                setSelectedAyah(ayahId);
              }
            }
          }
        }
      } catch (e) {
        console.error("Failed to parse URL query params", e);
      }
    }
  }, []);

  // Fetch verse and local tafseers when Surah or Ayah changes
  useEffect(() => {
    fetchVerseDetails(selectedSurah, selectedAyah);
    // Reset word selection & Gemini summary when moving to another Ayah
    setClickedWord(null);
    setWordData(null);
    setGeminiSummary("");
    setGeminiError("");
    setIrabText("");
    setIrabError("");
    setActiveIrabTab("full"); // Reset tab to full-verse
    setConcordanceData(null);
    setActiveConcordanceTab("root");

    // Stop and clear the full recitation audio if it was playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlayingFullAudio(false);
    }
  }, [selectedSurah, selectedAyah]);

  const fetchVerseDetails = async (surah: number, ayah: number) => {
    setVerseLoading(true);
    setVerseError("");
    setTafsirsLoading(true);

    try {
      // 1. Fetch from Quran.com API v4
      // We request: Saheeh International (20), Abdel Haleem (85), and Bridges (149)
      const quranUrl = `https://api.quran.com/api/v4/verses/by_key/${surah}:${ayah}?words=true&word_fields=text_uthmani,text_imlaei,location&translations=20,85,149`;
      const quranRes = await fetch(quranUrl);
      if (!quranRes.ok) {
        throw new Error("Failed to fetch verse text from Quran.com API");
      }
      const quranJson = await quranRes.json();
      setVerseData(quranJson.verse);

      // 2. Fetch local classical tafseers from our backend API
      const dbRes = await fetch(`/api/query?type=tafsir&surah_id=${surah}&ayah_id=${ayah}`);
      if (!dbRes.ok) {
        throw new Error("Failed to fetch classical tafseers from local database");
      }
      const dbJson = await dbRes.json();
      setTafsirs(dbJson.tafsirs || []);

    } catch (err: any) {
      console.error(err);
      setVerseError(err.message || "An error occurred while loading verse details.");
    } finally {
      setVerseLoading(false);
      setTafsirsLoading(false);
    }
  };

  const handleWordClick = async (word: Word) => {
    if (word.char_type_name === "end") return;
    setClickedWord(word);
    setWordLoading(true);
    setWordData(null);

    // Play WBW Audio
    if (word.audio_url) {
      const audio = new Audio(`https://audio.qurancdn.com/${word.audio_url}`);
      audio.play().catch((e) => console.log("Audio playback failed", e));
    }

    try {
      // Fetch morphology + roots from our database
      const res = await fetch(`/api/query?type=root&location=${word.location}`);
      if (!res.ok) throw new Error("Failed to fetch root details");
      const data = await res.json();
      setWordData(data);
      saveWordToVocabulary(word, data);

      // Programmatically open the Lexicon Deep Dive details element
      const lexiconDetails = document.getElementById("details-lexicon") as HTMLDetailsElement;
      if (lexiconDetails) {
        lexiconDetails.open = true;
      }

      // Auto-open I'rab accordion and switch to the word breakdown tab
      setIsIrabOpen(true);
      setActiveIrabTab("word");

      // Fetch occurrences
      if (data.root || data.morphology.length > 0) {
        setConcordanceLoading(true);
        setConcordanceData(null);
        
        const rootParam = data.root ? encodeURIComponent(data.root) : "";
        const stemPart = data.morphology.find((p: any) => ['N', 'V', 'ADJ', 'PN', 'STEM'].includes(p.tag)) || data.morphology[0];
        const formParam = stemPart ? encodeURIComponent(stemPart.form) : "";

        const occRes = await fetch(`/api/query?type=occurrences&root=${rootParam}&form=${formParam}`);
        if (occRes.ok) {
          const occData = await occRes.json();
          setConcordanceData(occData);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setWordLoading(false);
      setConcordanceLoading(false);
    }
  };

  const generateGeminiSummary = async (force: boolean = false) => {
    if (!verseData) return;
    setGeminiLoading(true);
    setGeminiError("");
    setGeminiSummary("");

    const verseText = verseData.words
      .filter((w) => w.char_type_name === "word")
      .map((w) => w.text_uthmani || w.text)
      .join(" ");

    try {
      // First try GET to see if it's cached (to save Gemini API usage)
      if (!force) {
        const getRes = await fetch(
          `/api/gemini?surah_id=${selectedSurah}&ayah_id=${selectedAyah}`
        );
        if (getRes.ok) {
          const data = await getRes.json();
          if (data && data.summary) {
            setGeminiSummary(data.summary);
            setGeminiLoading(false);
            return;
          }
        }
      }

      // Fallback or force: Call POST to generate it
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          surah_id: selectedSurah,
          ayah_id: selectedAyah,
          verse_text: verseText,
          force: force,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setGeminiError(data.error);
      } else {
        setGeminiSummary(data.summary);
      }
    } catch (err) {
      setGeminiError("Failed to communicate with AI summary service.");
    } finally {
      setGeminiLoading(false);
    }
  };

  const handlePlayRecitation = useCallback(() => {
    if (isPlayingFullAudio && audioRef.current) {
      audioRef.current.pause();
      setIsPlayingFullAudio(false);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const pad = (num: number, size: number) => {
      let s = num + "";
      while (s.length < size) s = "0" + s;
      return s;
    };
    const audioUrl = `https://mirrors.quranicaudio.com/everyayah/${selectedReciter}/${pad(selectedSurah, 3)}${pad(selectedAyah, 3)}.mp3`;

    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    setIsPlayingFullAudio(true);

    audio.play().catch((e) => {
      console.error("Failed to play recitation", e);
      setIsPlayingFullAudio(false);
    });

    audio.onended = () => {
      setIsPlayingFullAudio(false);
    };
  }, [selectedSurah, selectedAyah, isPlayingFullAudio, selectedReciter]);

  const fetchFullVerseIrab = useCallback(async () => {
    if (!verseData) return;
    setIrabLoading(true);
    setIrabError("");
    setIrabText("");

    const verseText = verseData.words
      .filter((w) => w.char_type_name === "word")
      .map((w) => w.text_uthmani || w.text)
      .join(" ");

    try {
      const res = await fetch(
        `/api/irab?surah_id=${selectedSurah}&ayah_id=${selectedAyah}&verse_text=${encodeURIComponent(verseText)}`
      );
      const data = await res.json();
      if (data.error) {
        setIrabError(data.error);
      } else {
        setIrabText(data.irab);
      }
    } catch (err) {
      setIrabError("Failed to fetch full-verse grammatical analysis.");
    } finally {
      setIrabLoading(false);
    }
  }, [verseData, selectedSurah, selectedAyah]);

  // Auto-fetch I'rab when verse details are loaded
  useEffect(() => {
    if (verseData && verseData.verse_key === `${selectedSurah}:${selectedAyah}`) {
      if (!irabText && !irabLoading) {
        fetchFullVerseIrab();
      }
    }
  }, [verseData, selectedSurah, selectedAyah, irabText, irabLoading, fetchFullVerseIrab]);

  // Navigations
  const handlePrevAyah = () => {
    if (selectedAyah > 1) {
      setSelectedAyah(selectedAyah - 1);
    } else if (selectedSurah > 1) {
      const prevSurah = selectedSurah - 1;
      const prevSurahCount = CHAPTERS.find((c) => c.id === prevSurah)?.verses_count || 1;
      setSelectedSurah(prevSurah);
      setSelectedAyah(prevSurahCount);
    }
  };

  const handleNextAyah = () => {
    if (selectedAyah < ayahCount) {
      setSelectedAyah(selectedAyah + 1);
    } else if (selectedSurah < 114) {
      setSelectedSurah(selectedSurah + 1);
      setSelectedAyah(1);
    }
  };

  // Translation helpers
  const getTranslationText = (resourceId: number) => {
    const translation = verseData?.translations.find((t) => t.resource_id === resourceId);
    if (!translation) return "Translation not available.";
    // Clean potential HTML tags (like <sup> or footnotes)
    return translation.text.replace(/<sup[^>]*>.*?<\/sup>/g, "").replace(/<[^>]*>/g, "");
  };

  // Simple Markdown renderer helper
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    
    // Split text by lines
    const lines = text.split("\n");
    let inList = false;
    const renderedElements = lines.map((line, idx) => {
      const trimmed = line.trim();
      
      // Headers
      if (trimmed.startsWith("###")) {
        return (
          <h4 key={idx} className="text-lg font-bold text-brand-emerald mt-4 mb-2">
            {trimmed.replace("###", "").trim()}
          </h4>
        );
      }
      if (trimmed.startsWith("##")) {
        return (
          <h3 key={idx} className="text-xl font-bold text-brand-indigo mt-5 mb-3">
            {trimmed.replace("##", "").trim()}
          </h3>
        );
      }
      
      // Bullets
      if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
        inList = true;
        const cleanContent = trimmed.substring(1).trim().replace(/\*\*(.*?)\*\*/g, "$1");
        return (
          <li key={idx} className="ml-5 list-disc text-slate-700 dark:text-slate-300 leading-relaxed mb-1">
            {cleanContent}
          </li>
        );
      }
      
      // Empty lines
      if (!trimmed) return <div key={idx} className="h-2" />;
      
      // Paragraph text
      // Replace bold markdown **text** with standard React element later if complex, or simple text replacement here
      const formattedLine = trimmed.replace(/\*\*(.*?)\*\*/g, "$1");
      return (
        <p key={idx} className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3 text-sm md:text-base">
          {formattedLine}
        </p>
      );
    });
    
    return <div className="space-y-1">{renderedElements}</div>;
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* HEADER SECTION */}
      <header className="sticky top-0 z-40 w-full glass-card border-b py-4 px-6 md:px-12 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-brand-emerald text-white font-bold p-2.5 rounded-xl shadow-md shadow-brand-emerald/20 flex items-center justify-center">
            <span className="text-lg">البَيَان</span>
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight bg-linear-to-r from-brand-emerald to-brand-indigo bg-clip-text text-transparent">
              Al-Bayan Quranic Study
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Deep Morphology, Lexicons & AI-Synthesised Exegesis
            </p>
          </div>
        </div>

        {/* SELECTORS */}
        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={handlePrevAyah}
            className="flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all active:scale-95"
            title="Previous Ayah"
          >
            ←
          </button>

          {/* Surah Dropdown */}
          <select
            value={selectedSurah}
            onChange={(e) => {
              setSelectedSurah(parseInt(e.target.value, 10));
              setSelectedAyah(1);
            }}
            className="h-10 px-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-emerald/50 cursor-pointer"
          >
            {CHAPTERS.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.id}. {ch.name_simple} ({ch.name_arabic})
              </option>
            ))}
          </select>

          {/* Ayah Dropdown */}
          <select
            value={selectedAyah}
            onChange={(e) => setSelectedAyah(parseInt(e.target.value, 10))}
            className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-emerald/50 cursor-pointer"
          >
            {Array.from({ length: ayahCount }, (_, i) => i + 1).map((aNum) => (
              <option key={aNum} value={aNum}>
                Ayah {aNum}
              </option>
            ))}
          </select>

          <button
            onClick={handleNextAyah}
            className="flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all active:scale-95"
            title="Next Ayah"
          >
            →
          </button>

          <Link
            href="/vocabulary"
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-brand-emerald/10 hover:bg-brand-emerald/20 text-brand-emerald font-semibold text-sm transition-all border border-brand-emerald/20 cursor-pointer active:scale-95 relative ml-2"
            title="Study Center & Retention Game"
          >
            <span className="text-base">🎓</span>
            <span className="hidden sm:inline">Study Center</span>
            {savedCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 bg-brand-indigo text-white text-[10px] font-bold rounded-full flex items-center justify-center border border-white dark:border-slate-950">
                {savedCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* MAIN LAYOUT CONTAINER */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto px-6 md:px-12 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: STICKY AYAH FOCUS & WBW GRID */}
        <section className="lg:col-span-7 flex flex-col gap-6 w-full lg:sticky lg:top-[90px] self-start">
          {/* Main Ayah Box */}
          <div className="glass-card rounded-3xl p-6 md:p-8 flex flex-col gap-8 shadow-xs border relative overflow-hidden">
            {/* Background design glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-emerald/5 dark:bg-brand-emerald/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
            
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800/60 pb-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Surah {CHAPTERS.find(c => c.id === selectedSurah)?.name_simple} ({selectedSurah}:{selectedAyah})
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Recitation Option Selector and Button */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePlayRecitation}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer active:scale-95 ${
                      isPlayingFullAudio
                        ? "bg-brand-emerald text-white animate-pulse"
                        : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/80"
                    }`}
                    title={isPlayingFullAudio ? "Pause Recitation" : `Listen to recitation by ${RECITERS.find(r => r.id === selectedReciter)?.name}`}
                  >
                    {isPlayingFullAudio ? (
                      <>
                        <span className="text-[10px]">⏸️</span>
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <span className="text-[10px]">▶️</span>
                        <span>Listen</span>
                      </>
                    )}
                  </button>

                  <div className="relative">
                    <select
                      value={selectedReciter}
                      onChange={(e) => setSelectedReciter(e.target.value)}
                      className="appearance-none bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 text-xs font-semibold px-3 py-1 pr-7 rounded-full border-none focus:outline-hidden focus:ring-2 focus:ring-brand-emerald/40 transition-all cursor-pointer"
                      title="Choose Reciter"
                    >
                      {RECITERS.map((r) => (
                        <option key={r.id} value={r.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0.5 flex items-center pr-2 pointer-events-none text-slate-400 dark:text-slate-500">
                      <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-brand-emerald/10 dark:bg-brand-emerald/20 text-brand-emerald font-semibold text-xs px-3 py-1 rounded-full">
                  {selectedSurah}:{selectedAyah}
                </div>
              </div>
            </div>

            {verseLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-12 h-12 border-4 border-slate-200 dark:border-slate-800 border-t-brand-emerald rounded-full animate-spin" />
                <p className="text-sm text-slate-500 dark:text-slate-400 animate-pulse">Loading Ayah text...</p>
              </div>
            ) : verseError ? (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl text-red-700 dark:text-red-400 text-sm text-center">
                {verseError}
              </div>
            ) : verseData ? (
              <div className="flex flex-col gap-8">
                {/* 1. Large unified Arabic Text */}
                <div className="rtl-text text-right text-4xl md:text-5xl lg:text-6xl text-slate-900 dark:text-white leading-loose font-arabic select-all">
                  {verseData.words
                    .map((w) => w.text_uthmani || w.text)
                    .join(" ")}
                </div>

                {/* 2. Interactive Word-by-Word Grid */}
                <div className="flex flex-col gap-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Word-by-Word Analysis (Click a word to study root & morphology)
                  </h3>
                  
                  {/* Grid layout containing cards ordered RTL */}
                  <div className="flex flex-row-reverse flex-wrap gap-3.5 justify-center md:justify-start bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/40">
                    {verseData.words.map((word) => {
                      const isEnd = word.char_type_name === "end";
                      const isSelected = clickedWord?.id === word.id;
                      
                      return (
                        <div
                          key={word.id}
                          onClick={() => !isEnd && handleWordClick(word)}
                          className={`flex flex-col items-center p-3 rounded-xl transition-all duration-200 select-none ${
                            isEnd 
                              ? "bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/50 text-brand-indigo font-bold cursor-default" 
                              : `border hover:scale-103 hover:shadow-md cursor-pointer ${
                                  isSelected 
                                    ? "bg-brand-emerald text-white border-brand-emerald shadow-lg shadow-brand-emerald/15" 
                                    : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800/80 text-slate-800 dark:text-slate-200 hover:border-brand-emerald/50"
                                }`
                          }`}
                        >
                          {/* Arabic word token */}
                          <span className={`text-xl md:text-2xl font-arabic mb-2 ${isEnd ? "text-slate-500 dark:text-slate-400" : ""}`}>
                            {word.text_uthmani || word.text}
                          </span>
                          
                          {/* Metadata tokens (only if not verse end) */}
                          {!isEnd && (
                            <div className="flex flex-col items-center gap-0.5 text-center">
                              <span className={`text-[10px] font-mono leading-none tracking-tight ${isSelected ? "text-emerald-100" : "text-slate-400 dark:text-slate-500"}`}>
                                {word.transliteration.text}
                              </span>
                              <span className={`text-[11px] font-medium leading-none mt-1.5 max-w-[90px] truncate ${isSelected ? "text-white" : "text-slate-600 dark:text-slate-350"}`}>
                                {word.translation.text}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* RIGHT COLUMN: STUDY DETAILS ACCORDIONS */}
        <section className="lg:col-span-5 flex flex-col gap-4 w-full">
          <details 
            id="details-translations"
            name="quran-accordion" 
            className="group glass-card rounded-2xl border border-slate-200 dark:border-slate-800/80 overflow-hidden shadow-xs"
            open
          >
            <summary className="flex items-center justify-between p-5 select-none font-bold text-sm md:text-base text-slate-800 dark:text-slate-200 border-b border-transparent group-open:border-slate-100 dark:group-open:border-slate-800/50 group-open:bg-slate-50/50 dark:group-open:bg-slate-900/35 transition-all">
              <div className="flex items-center gap-2.5">
                <span className="text-brand-emerald text-lg">📖</span>
                <span>Side-by-Side Translations</span>
              </div>
              <span className="text-slate-400 transition-transform duration-200 group-open:rotate-180">▼</span>
            </summary>
            
            <div className="p-5 flex flex-col gap-4 divide-y divide-slate-100 dark:divide-slate-800/50">
              {verseLoading ? (
                <div className="py-4 text-center text-xs text-slate-400 animate-pulse">Loading translations...</div>
              ) : verseData ? (
                <>
                  {/* Abdel Haleem (ID 85) */}
                  <div className="pt-0 pb-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-emerald bg-emerald-500/10 dark:bg-emerald-500/20 px-2 py-0.5 rounded-md">
                        M.A.S. Abdel Haleem
                      </span>
                      <span className="text-[10px] text-slate-400">Flowing Academic</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-350 text-sm leading-relaxed">
                      {getTranslationText(85)}
                    </p>
                  </div>

                  {/* Sahih International (ID 20) */}
                  <div className="pt-3 pb-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-indigo bg-indigo-500/10 dark:bg-indigo-500/20 px-2 py-0.5 rounded-md">
                        Sahih International
                      </span>
                      <span className="text-[10px] text-slate-400">Standard / Literal</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-350 text-sm leading-relaxed">
                      {getTranslationText(20)}
                    </p>
                  </div>

                  {/* Bridges Translation (ID 149) */}
                  <div className="pt-3 pb-0 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-teal bg-teal-500/10 dark:bg-teal-500/20 px-2 py-0.5 rounded-md">
                        Bridges Translation
                      </span>
                      <span className="text-[10px] text-slate-400">Qira&apos;at Variations</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-350 text-sm leading-relaxed">
                      {getTranslationText(149)}
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-center py-4 text-xs text-slate-400">Select an Ayah to view translations.</div>
              )}
            </div>
          </details>
          <details 
            id="details-irab"
            name="quran-accordion"
            className="group glass-card rounded-2xl border border-slate-200 dark:border-slate-800/80 overflow-hidden shadow-xs"
            open={isIrabOpen}
            onToggle={(e) => {
              const isOpen = (e.target as HTMLDetailsElement).open;
              setIsIrabOpen(isOpen);
              if (isOpen) {
                // Default to full-verse analysis when manually opened
                setActiveIrabTab("full");
              }
            }}
          >
            <summary className="flex items-center justify-between p-5 select-none font-bold text-sm md:text-base text-slate-800 dark:text-slate-200 border-b border-transparent group-open:border-slate-100 dark:group-open:border-slate-800/50 group-open:bg-slate-50/50 dark:group-open:bg-slate-900/35 transition-all">
              <div className="flex items-center gap-2.5">
                <span className="text-brand-emerald text-lg">📐</span>
                <span>I&apos;rab (Syntactical Analysis)</span>
              </div>
              <span className="text-slate-400 transition-transform duration-200 group-open:rotate-180">▼</span>
            </summary>
            
            <div className="p-5 flex flex-col gap-4">
              {/* Tab Selector */}
              <div className="flex border-b border-slate-100 dark:border-slate-800/80 p-0.5 gap-2 bg-slate-50/50 dark:bg-slate-900/35 rounded-xl">
                <button
                  onClick={() => setActiveIrabTab("full")}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                    activeIrabTab === "full"
                      ? "bg-white dark:bg-slate-950 text-brand-emerald shadow-xs border border-slate-100 dark:border-slate-800/50"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-350"
                  }`}
                >
                  📐 Full-Verse Analysis
                </button>
                <button
                  onClick={() => setActiveIrabTab("word")}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                    activeIrabTab === "word"
                      ? "bg-white dark:bg-slate-950 text-brand-indigo shadow-xs border border-slate-100 dark:border-slate-800/50"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-350"
                  }`}
                >
                  🔍 Word Breakdown
                </button>
              </div>

              {/* Tab Content */}
              <div className="mt-2">
                {activeIrabTab === "full" ? (
                  <div className="w-full">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-brand-emerald mb-3">
                      Full-Verse Grammatical Analysis (Tantawi Style)
                    </h4>
                    
                    {irabLoading ? (
                      <div className="flex flex-col gap-2 py-4">
                        <div className="h-4 bg-slate-100 dark:bg-slate-900 rounded-sm animate-pulse w-3/4" />
                        <div className="h-4 bg-slate-100 dark:bg-slate-900 rounded-sm animate-pulse w-full" />
                        <div className="h-4 bg-slate-100 dark:bg-slate-900 rounded-sm animate-pulse w-5/6" />
                        <div className="h-4 bg-slate-100 dark:bg-slate-900 rounded-sm animate-pulse w-2/3" />
                      </div>
                    ) : irabError ? (
                      <p className="text-xs text-red-500 dark:text-red-400">{irabError}</p>
                    ) : irabText ? (
                      <div className="prose prose-slate dark:prose-invert max-w-none text-sm leading-relaxed flex flex-col gap-1">
                        {renderMarkdown(irabText)}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic">Expanding this accordion fetches the full-verse grammatical breakdown...</div>
                    )}
                  </div>
                ) : (
                  <div className="w-full">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-brand-indigo mb-3">
                      Word-by-Word Morphological Breakdown
                    </h4>

                    {!clickedWord ? (
                      <div className="text-center py-8 px-4 bg-slate-50/50 dark:bg-slate-900/25 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800/80 flex flex-col items-center gap-2.5">
                        <span className="text-2xl animate-bounce">👆</span>
                        <p className="text-xs text-slate-500 dark:text-slate-450 max-w-xs leading-relaxed">
                          Click any word in the Arabic verse above to inspect its exact word segments, tags, and grammatical features in plain English here.
                        </p>
                      </div>
                    ) : wordLoading ? (
                      <div className="flex items-center justify-center py-8 gap-2">
                        <div className="w-5 h-5 border-2 border-slate-200 dark:border-slate-800 border-t-brand-indigo rounded-full animate-spin" />
                        <p className="text-xs text-slate-500">Querying syntax data...</p>
                      </div>
                    ) : wordData && wordData.morphology.length > 0 ? (
                      <div className="flex flex-col gap-4">
                        <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800/50 flex justify-between items-center">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Location</span>
                            <p className="text-xs font-bold font-mono text-slate-600 dark:text-slate-350">{clickedWord.location}</p>
                          </div>
                          <div className="rtl-text text-xl font-bold text-brand-indigo">{clickedWord.text_uthmani || clickedWord.text}</div>
                        </div>

                        <div className="flex flex-col gap-3">
                          {wordData.morphology.map((part) => {
                            const parsedExplanations = parseFeatureString(part.features, part.tag);
                            return (
                              <div 
                                key={part.part_id} 
                                className="p-3 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/60 rounded-xl flex flex-col gap-2.5 shadow-xs"
                              >
                                <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-900 pb-1.5">
                                  <span className="text-[9px] uppercase font-extrabold text-brand-indigo bg-indigo-500/10 dark:bg-indigo-500/20 px-2 py-0.5 rounded-sm">
                                    Segment {part.part_id}
                                  </span>
                                  <span className="text-xs font-bold font-mono text-slate-400 dark:text-slate-500">{part.form}</span>
                                </div>

                                {/* Detailed properties */}
                                <div className="flex flex-col gap-1.5">
                                  {parsedExplanations.map((exp, expIdx) => (
                                    <div key={expIdx} className="flex justify-between items-center text-xs border-b border-slate-50/50 dark:border-slate-900/30 py-0.5 last:border-b-0">
                                      <span className="text-slate-400 text-[10px]">{exp.label}</span>
                                      <span className="font-semibold text-slate-700 dark:text-slate-300 text-right">{exp.value}</span>
                                    </div>
                                  ))}
                                </div>

                                {/* Raw Features */}
                                <div className="text-[9px] text-slate-400 flex flex-col gap-0.5 mt-1 bg-slate-50 dark:bg-slate-900/30 p-1.5 rounded-sm">
                                  <span>Raw Features Code:</span>
                                  <code className="font-mono text-brand-indigo break-all">{part.features}</code>
                                </div>

                                {part.arabic_root && (
                                  <div className="flex items-center justify-between text-xs mt-1 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10 px-2 py-1 rounded-sm">
                                    <span className="text-slate-400 text-[10px]">Triliteral Root</span>
                                    <span className="font-bold rtl-text text-brand-emerald">{part.arabic_root}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-xs text-slate-400">
                        No detailed syntax parts found for this word token.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </details>
          <details 
            id="details-lexicon"
            name="quran-accordion"
            className="group glass-card rounded-2xl border border-slate-200 dark:border-slate-800/80 overflow-hidden shadow-xs"
          >
            <summary className="flex items-center justify-between p-5 select-none font-bold text-sm md:text-base text-slate-800 dark:text-slate-200 border-b border-transparent group-open:border-slate-100 dark:group-open:border-slate-800/50 group-open:bg-slate-50/50 dark:group-open:bg-slate-900/35 transition-all">
              <div className="flex items-center gap-2.5">
                <span className="text-brand-emerald text-lg">📚</span>
                <span>Lexicon Deep Dive</span>
              </div>
              <span className="text-slate-400 transition-transform duration-200 group-open:rotate-180">▼</span>
            </summary>
            
            <div className="p-5">
              {!clickedWord ? (
                <div className="text-center py-6 flex flex-col items-center gap-2">
                  <span className="text-xl">🔎</span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
                    Click on any word in the verse to extract its root letters and search classical Arabic lexicons.
                  </p>
                </div>
              ) : wordLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-8 h-8 border-3 border-slate-200 dark:border-slate-800 border-t-brand-emerald rounded-full animate-spin" />
                  <p className="text-xs text-slate-500 animate-pulse">Searching classical dictionaries...</p>
                </div>
              ) : wordData && wordData.root ? (
                <div className="flex flex-col gap-4">
                  {/* Root header */}
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <span className="text-xs text-slate-400">Triliteral Root</span>
                      <div className="text-2xl font-bold rtl-text text-right text-brand-emerald font-arabic mt-0.5">{wordData.root}</div>
                    </div>
                    <span className="text-xs bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 px-3 py-1 rounded-full font-bold">
                      {wordData.entries.length} Dictionaries
                    </span>
                  </div>

                  {/* Dictionaries Entries */}
                  {wordData.entries.length > 0 ? (
                    <div className="flex flex-col gap-4 max-h-96 overflow-y-auto pr-1">
                      {[...wordData.entries]
                        .sort((a, b) => {
                          const isAEnglish = a.source_book === 'quranic_usage';
                          const isBEnglish = b.source_book === 'quranic_usage';
                          if (isAEnglish && !isBEnglish) return -1;
                          if (!isAEnglish && isBEnglish) return 1;
                          return 0;
                        })
                        .map((entry, idx) => {
                          const isEnglish = entry.source_book === 'quranic_usage';
                        return (
                          <div 
                            key={idx} 
                            className="bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/60 rounded-xl p-4 shadow-2xs flex flex-col gap-2.5"
                          >
                            <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-900 pb-1.5">
                              <span className="text-xs font-extrabold uppercase tracking-wider text-brand-indigo">
                                {entry.source_book === 'ibn_faris' ? 'Maqayis al-Lughah' : 
                                 'Dictionary of Quranic Usage'}
                              </span>
                              <span className="text-[10px] text-slate-400 uppercase font-bold">
                                {isEnglish ? 'English' : 'Arabic'}
                              </span>
                            </div>
                            <div className={`text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap ${isEnglish ? 'text-left' : 'rtl-text text-right text-base font-arabic'}`}>
                              {entry.definition}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-xs text-slate-400">
                      No matching dictionary entries found in the local database for root &quot;{wordData.root}&quot;.
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-slate-400">
                  This word does not have a linguistic root mapped in the corpus (e.g. it may be a particle, letter, or pronoun).
                </div>
              )}
            </div>
          </details>

          {/* ACCORDION: QURANIC CONCORDANCE (OCCURRENCES) */}
          <details 
            id="details-concordance"
            name="quran-accordion" 
            className="group glass-card rounded-2xl border border-slate-200 dark:border-slate-800/80 overflow-hidden shadow-xs"
          >
            <summary className="flex items-center justify-between p-5 select-none font-bold text-sm md:text-base text-slate-800 dark:text-slate-200 border-b border-transparent group-open:border-slate-100 dark:group-open:border-slate-800/50 group-open:bg-slate-50/50 dark:group-open:bg-slate-900/35 transition-all">
              <div className="flex items-center gap-2.5">
                <span className="text-brand-emerald text-lg">🔍</span>
                <span>Quranic Concordance (Word Usage)</span>
              </div>
              <span className="text-slate-400 transition-transform duration-200 group-open:rotate-180">▼</span>
            </summary>
            
            <div className="p-5">
              {!clickedWord ? (
                <div className="text-center py-6 flex flex-col items-center gap-2">
                  <span className="text-xl">📊</span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
                    Click on any word in the verse to see where its root or segment form is used elsewhere in the Quran.
                  </p>
                </div>
              ) : concordanceLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-8 h-8 border-3 border-slate-200 dark:border-slate-800 border-t-brand-emerald rounded-full animate-spin" />
                  <p className="text-xs text-slate-500 animate-pulse">Searching Quranic concordance...</p>
                </div>
              ) : concordanceData ? (
                <div className="flex flex-col gap-4">
                  {/* Tab Selector */}
                  <div className="flex border-b border-slate-100 dark:border-slate-800/80 p-0.5 gap-2 bg-slate-50/50 dark:bg-slate-900/35 rounded-xl">
                    <button
                      onClick={() => setActiveConcordanceTab("root")}
                      className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                        activeConcordanceTab === "root"
                          ? "bg-white dark:bg-slate-950 text-brand-emerald shadow-xs border border-slate-100 dark:border-slate-800/50"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-350"
                      }`}
                    >
                      🌿 Root ({concordanceData.root || "None"})
                    </button>
                    <button
                      onClick={() => setActiveConcordanceTab("form")}
                      className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                        activeConcordanceTab === "form"
                          ? "bg-white dark:bg-slate-950 text-brand-indigo shadow-xs border border-slate-100 dark:border-slate-800/50"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-350"
                      }`}
                    >
                      🔤 Form ({concordanceData.form || "None"})
                    </button>
                  </div>

                  {/* Tab Content */}
                  <div className="mt-2">
                    {activeConcordanceTab === "root" ? (
                      <div className="w-full flex flex-col gap-3">
                        <div className="flex justify-between items-center text-xs border-b border-slate-100 dark:border-slate-800 pb-2">
                          <span className="text-slate-400">Total Occurrences for Root &quot;{concordanceData.root}&quot;</span>
                          <span className="font-bold text-brand-emerald bg-emerald-500/10 dark:bg-emerald-500/20 px-2 py-0.5 rounded-full">
                            {concordanceData.rootOccurrences.length} times
                          </span>
                        </div>

                        {concordanceData.rootOccurrences.length > 0 ? (
                          <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
                            {(() => {
                              const grouped = groupOccurrences(concordanceData.rootOccurrences);
                              return grouped.map((group) => (
                                <div key={group.surahId} className="flex flex-col gap-1 text-xs">
                                  <div className="font-bold text-slate-700 dark:text-slate-300">
                                    {group.surahId}. {group.surahName}
                                  </div>
                                  <div className="flex flex-wrap gap-1.5 pl-2 mt-1 mb-2">
                                    {group.ayahs.map((ayah) => {
                                      const isCurrent = selectedSurah === group.surahId && selectedAyah === ayah;
                                      return (
                                        <button
                                          key={ayah}
                                          onClick={() => {
                                            setSelectedSurah(group.surahId);
                                            setSelectedAyah(ayah);
                                          }}
                                          className={`px-2.5 py-0.5 rounded-md border text-[11px] font-semibold transition-all cursor-pointer ${
                                            isCurrent
                                              ? "bg-brand-emerald text-white border-brand-emerald shadow-xs"
                                              : "bg-slate-50 dark:bg-slate-900 border-slate-200/60 dark:border-slate-800/80 text-slate-600 dark:text-slate-400 hover:border-brand-emerald hover:text-brand-emerald"
                                          }`}
                                        >
                                          Ayah {ayah}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-xs text-slate-400">No occurrences found for this root.</div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full flex flex-col gap-3">
                        <div className="flex justify-between items-center text-xs border-b border-slate-100 dark:border-slate-800 pb-2">
                          <span className="text-slate-400">Total Occurrences for Segment &quot;{concordanceData.form}&quot;</span>
                          <span className="font-bold text-brand-indigo bg-indigo-500/10 dark:bg-indigo-500/20 px-2 py-0.5 rounded-full">
                            {concordanceData.formOccurrences.length} times
                          </span>
                        </div>

                        {concordanceData.formOccurrences.length > 0 ? (
                          <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
                            {(() => {
                              const grouped = groupOccurrences(concordanceData.formOccurrences);
                              return grouped.map((group) => (
                                <div key={group.surahId} className="flex flex-col gap-1 text-xs">
                                  <div className="font-bold text-slate-700 dark:text-slate-300">
                                    {group.surahId}. {group.surahName}
                                  </div>
                                  <div className="flex flex-wrap gap-1.5 pl-2 mt-1 mb-2">
                                    {group.ayahs.map((ayah) => {
                                      const isCurrent = selectedSurah === group.surahId && selectedAyah === ayah;
                                      return (
                                        <button
                                          key={ayah}
                                          onClick={() => {
                                            setSelectedSurah(group.surahId);
                                            setSelectedAyah(ayah);
                                          }}
                                          className={`px-2.5 py-0.5 rounded-md border text-[11px] font-semibold transition-all cursor-pointer ${
                                            isCurrent
                                              ? "bg-brand-indigo text-white border-brand-indigo shadow-xs"
                                              : "bg-slate-50 dark:bg-slate-900 border-slate-200/60 dark:border-slate-800/80 text-slate-600 dark:text-slate-400 hover:border-brand-indigo hover:text-brand-indigo"
                                          }`}
                                        >
                                          Ayah {ayah}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-xs text-slate-400">No occurrences found for this segment form.</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-slate-400">Select a word to view usage statistics.</div>
              )}
            </div>
          </details>

          <details 
            id="details-english-tafsir"
            name="quran-accordion" 
            className="group glass-card rounded-2xl border border-slate-200 dark:border-slate-800/80 overflow-hidden shadow-xs"
          >
            <summary className="flex items-center justify-between p-5 select-none font-bold text-sm md:text-base text-slate-800 dark:text-slate-200 border-b border-transparent group-open:border-slate-100 dark:group-open:border-slate-800/50 group-open:bg-slate-50/50 dark:group-open:bg-slate-900/35 transition-all">
              <div className="flex items-center gap-2.5">
                <span className="text-brand-emerald text-lg">💡</span>
                <span>Tafsir Ibn Kathir (English)</span>
              </div>
              <span className="text-slate-400 transition-transform duration-200 group-open:rotate-180">▼</span>
            </summary>
            
            <div className="p-5 max-h-96 overflow-y-auto">
              {tafsirsLoading ? (
                <div className="py-6 text-center text-xs text-slate-400 animate-pulse">Loading English Tafseer...</div>
              ) : tafsirs.some(t => t.source_book === 'ibn_kathir') ? (
                <div className="flex flex-col gap-3">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-brand-emerald bg-emerald-500/10 dark:bg-emerald-500/20 px-2.5 py-1 rounded-md w-fit">
                    Tafsir Ibn Kathir
                  </div>
                  <p className="text-slate-700 dark:text-slate-350 text-sm md:text-base leading-relaxed whitespace-pre-wrap">
                    {tafsirs.find(t => t.source_book === 'ibn_kathir')?.content}
                  </p>
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-slate-400">
                  Tafsir Ibn Kathir is not available for this verse in the database.
                </div>
              )}
            </div>
          </details>
          <details 
            id="details-arabic-tafsir"
            name="quran-accordion" 
            className="group glass-card rounded-2xl border border-slate-200 dark:border-slate-800/80 overflow-hidden shadow-xs"
          >
            <summary className="flex items-center justify-between p-5 select-none font-bold text-sm md:text-base text-slate-800 dark:text-slate-200 border-b border-transparent group-open:border-slate-100 dark:group-open:border-slate-800/50 group-open:bg-slate-50/50 dark:group-open:bg-slate-900/35 transition-all">
              <div className="flex items-center gap-2.5">
                <span className="text-brand-emerald text-lg">✒️</span>
                <span>Arabic Tafseers (Sa'di, Ashur &amp; Qurtubi)</span>
              </div>
              <span className="text-slate-400 transition-transform duration-200 group-open:rotate-180">▼</span>
            </summary>
            
            <div className="p-5 max-h-96 overflow-y-auto flex flex-col gap-6">
              {tafsirsLoading ? (
                <div className="py-6 text-center text-xs text-slate-400 animate-pulse">Loading Arabic commentary...</div>
              ) : tafsirs.some(t => ['saadi', 'ibn_ashur', 'qurtubi'].includes(t.source_book)) ? (
                (() => {
                  const activeTafseers = [
                    { key: 'saadi', name: 'السعدي (تيسير الكريم الرحمن)', color: 'text-brand-emerald' },
                    { key: 'ibn_ashur', name: 'ابن عاشور (التحرير والتنوير)', color: 'text-brand-indigo' },
                    { key: 'qurtubi', name: 'القرطبي (الجامع لأحكام القرآن)', color: 'text-brand-teal' }
                  ].filter(t => tafsirs.some(row => row.source_book === t.key));

                  return activeTafseers.map((t, index) => {
                    const row = tafsirs.find(r => r.source_book === t.key);
                    return (
                      <div 
                        key={t.key} 
                        className={`flex flex-col gap-2.5 ${index > 0 ? 'border-t border-slate-100 dark:border-slate-800/50 pt-4' : ''}`}
                      >
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800/50 pb-2">
                          <span className={`text-xs font-bold ${t.color}`}>{t.name}</span>
                          <span className="text-[10px] text-slate-400 uppercase font-mono">{t.key}</span>
                        </div>
                        <div className="rtl-text text-right text-lg text-slate-800 dark:text-slate-200 leading-loose whitespace-pre-wrap select-all font-arabic">
                          {row?.content}
                        </div>
                      </div>
                    );
                  });
                })()
              ) : (
                <div className="text-center py-6 text-xs text-slate-400">
                  No Arabic Tafseer commentary available for this verse in the database.
                </div>
              )}
            </div>
          </details>
          <details 
            id="details-gemini"
            name="quran-accordion" 
            className="group glass-card rounded-2xl border border-slate-200 dark:border-slate-800/80 overflow-hidden shadow-xs"
          >
            <summary className="flex items-center justify-between p-5 select-none font-bold text-sm md:text-base text-slate-800 dark:text-slate-200 border-b border-transparent group-open:border-slate-100 dark:group-open:border-slate-800/50 group-open:bg-slate-50/50 dark:group-open:bg-slate-900/35 transition-all">
              <div className="flex items-center gap-2.5">
                <span className="text-brand-emerald text-lg">⚡</span>
                <span>AI Exegesis (Gemini Summary)</span>
              </div>
              <span className="text-slate-400 transition-transform duration-200 group-open:rotate-180">▼</span>
            </summary>
            
            <div className="p-5 flex flex-col gap-4">
              {!geminiSummary && !geminiLoading && (
                <div className="py-6 flex flex-col items-center gap-4 text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
                    Generate an on-demand, integrated English summary of the Arabic Tafseers (Ibn Ashur &amp; Al-Qurtubi) using Google Gemini AI.
                  </p>
                  <button
                    onClick={() => generateGeminiSummary(false)}
                    disabled={verseLoading || tafsirsLoading}
                    className="px-5 py-2.5 bg-linear-to-r from-brand-emerald to-brand-teal text-white font-semibold text-xs rounded-xl shadow-md shadow-brand-emerald/15 hover:scale-103 active:scale-97 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Generate English Tafseer Summary
                  </button>
                </div>
              )}

              {geminiLoading && (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="w-10 h-10 border-3 border-slate-200 dark:border-slate-800 border-t-brand-emerald rounded-full animate-spin" />
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-xs font-semibold text-slate-500">Synthesizing classical Arabic Tafseers...</p>
                    <p className="text-[10px] text-slate-400">This may take 5-10 seconds</p>
                  </div>
                </div>
              )}

              {geminiError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl text-red-700 dark:text-red-400 text-xs text-center">
                  {geminiError}
                </div>
              )}

              {geminiSummary && (
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-indigo bg-indigo-500/10 dark:bg-indigo-500/20 px-2 py-0.5 rounded-md">
                      AI Generated Synthesis
                    </span>
                    <button
                      onClick={() => generateGeminiSummary(true)}
                      className="text-xs text-brand-emerald font-semibold hover:underline cursor-pointer"
                    >
                      Regenerate
                    </button>
                  </div>
                  
                  <div className="markdown-body text-slate-800 dark:text-slate-250 select-text">
                    {renderMarkdown(geminiSummary)}
                  </div>
                </div>
              )}
            </div>
          </details>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="w-full py-6 mt-12 border-t border-slate-200 dark:border-slate-800/80 bg-white/20 dark:bg-slate-950/25 backdrop-blur-xs text-center text-xs text-slate-400">
        <p className="leading-relaxed">
          Al-Bayan Quranic Study Application &bull; Built with Next.js, Tailwind CSS v4 &amp; better-sqlite3
        </p>
        <p className="text-[10px] text-slate-500 dark:text-slate-600 mt-1">
          Linguistic morphological data sourced from the <a href="http://corpus.quran.com" className="hover:underline text-slate-400" target="_blank" rel="noopener noreferrer">Quranic Arabic Corpus</a>.
        </p>
      </footer>

      {/* Toast Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center gap-3 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xl transition-all duration-300 animate-slide-in-up backdrop-blur-md"
          >
            <div className="bg-brand-emerald/10 text-brand-emerald p-2 rounded-xl text-lg flex items-center justify-center font-bold">
              🎓
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Saved to Vocabulary</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-arabic text-lg text-slate-850 dark:text-slate-100 leading-none">{toast.arabic}</span>
                <span className="text-xs text-slate-400 font-mono">→</span>
                <span className="text-sm font-semibold text-brand-indigo">{toast.translation}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
