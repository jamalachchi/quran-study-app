import { useState, useEffect, useCallback, useMemo } from "react";
import type { Word, LexiconData, OccurrenceGroup } from "../lib/types";
import { parseFeatureString, groupOccurrences } from "../lib/utils";
import { BookOpen, ChevronDown, ChevronUp, HelpCircle, Layers, Link as LinkIcon, Loader2, X } from "lucide-react";
import { API_BASE_URL } from "../lib/api";

const stopWords = new Set([
  "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your", "yours", 
  "yourself", "yourselves", "he", "him", "his", "himself", "she", "her", "hers", "herself", 
  "it", "its", "itself", "they", "them", "their", "theirs", "themselves", "what", "which", 
  "who", "whom", "this", "that", "these", "those", "am", "is", "are", "was", "were", "be", 
  "been", "being", "have", "has", "had", "having", "do", "does", "did", "doing", "a", "an", 
  "the", "and", "but", "if", "or", "because", "as", "until", "while", "of", "at", "by", 
  "for", "with", "about", "against", "between", "into", "through", "during", "before", 
  "after", "above", "below", "to", "from", "up", "down", "in", "out", "on", "off", "over", 
  "under", "again", "further", "then", "once"
]);

function getStem(word: string): string {
  let stem = word.toLowerCase().trim();
  const suffixes = [
    "ing", "edly", "fully", "ment", "ness", "tion", "sion", "able", "ible", 
    "less", "ed", "es", "ly", "ful", "ive", "al", "ous", "er", "est", "s", "y"
  ];
  
  for (const suffix of suffixes) {
    if (stem.endsWith(suffix) && stem.length - suffix.length >= 3) {
      stem = stem.slice(0, -suffix.length);
      break;
    }
  }
  return stem;
}

function getPatternForStem(stem: string): string {
  if (stem.endsWith("i") && stem.length > 1) {
    return `${stem.slice(0, -1)}(i|y)[a-z]*`;
  }
  if (stem.length >= 4) {
    return `${stem}[a-z]*`;
  }
  return `${stem}s?`;
}

function highlightTranslationText(text: string, matchingWords: any[]): string {
  if (!text || !matchingWords || matchingWords.length === 0) return text;
  
  const patterns: string[] = [];
  
  matchingWords.forEach((w: any) => {
    const rawText = w.translation?.text;
    if (!rawText) return;
    
    // Clean text (remove brackets, parentheses, punctuation)
    const cleanText = rawText.replace(/[\[\]\(\)\-\+\?\!\.\,\;\:\"]/g, "").trim().toLowerCase();
    if (!cleanText) return;
    
    // Split into individual words
    const words = cleanText.split(/\s+/);
    words.forEach((wd: string) => {
      if (stopWords.has(wd)) return;
      
      const stem = getStem(wd);
      if (stem.length >= 2) {
        const pattern = getPatternForStem(stem);
        patterns.push(pattern);
      }
    });
  });
  
  if (patterns.length === 0) return text;
  
  // Deduplicate and sort by length descending to match longer phrases first
  const uniquePatterns = Array.from(new Set(patterns)).sort((a, b) => b.length - a.length);
  
  // Build regex matching any pattern as a word boundary
  const regex = new RegExp(`\\b(${uniquePatterns.join('|')})\\b`, 'gi');
  
  return text.replace(regex, (match) => {
    return `<mark class="bg-brand-emerald/10 dark:bg-brand-emerald/25 text-brand-emerald font-semibold px-1 rounded-sm">${match}</mark>`;
  });
}

interface BottomSheetProps {
  word: Word | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateAyah: (surahId: number, ayahId: number) => void;
  selectedTranslation: number;
}

export default function BottomSheet({ word, isOpen, onClose, onNavigateAyah, selectedTranslation }: BottomSheetProps) {
  const [activeTab, setActiveTab] = useState<"morphology" | "lexicon" | "concordance">("morphology");
  const [lexiconData, setLexiconData] = useState<LexiconData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  
  const [concordanceData, setConcordanceData] = useState<{
    root: string | null;
    form: string;
    rootOccurrences: string[];
    formOccurrences: string[];
  } | null>(null);
  const [concordanceLoading, setConcordanceLoading] = useState<boolean>(false);
  const [activeConcTab, setActiveConcTab] = useState<"root" | "form">("root");
  const [showArabicMap, setShowArabicMap] = useState<Record<number, boolean>>({});

  // Preview states for concordance occurrences
  const [previews, setPreviews] = useState<Record<string, { words: any[]; translation: string; loading: boolean; error?: string }>>({});
  const [expandedPreviews, setExpandedPreviews] = useState<Record<string, boolean>>({});

  // Extract current verse coordinates
  const [currentSurahId, currentAyahId] = useMemo(() => {
    if (!word) return [null, null];
    const [s, a] = word.location.split(":");
    return [parseInt(s, 10), parseInt(a, 10)];
  }, [word]);

  // Filter out the active verse from occurrences so it is not listed redundantly
  const filteredRootOccurrences = useMemo(() => {
    if (!concordanceData?.rootOccurrences) return [];
    return concordanceData.rootOccurrences.filter(loc => {
      const [s, a] = loc.split(":");
      return !(parseInt(s, 10) === currentSurahId && parseInt(a, 10) === currentAyahId);
    });
  }, [concordanceData?.rootOccurrences, currentSurahId, currentAyahId]);

  const filteredFormOccurrences = useMemo(() => {
    if (!concordanceData?.formOccurrences) return [];
    return concordanceData.formOccurrences.filter(loc => {
      const [s, a] = loc.split(":");
      return !(parseInt(s, 10) === currentSurahId && parseInt(a, 10) === currentAyahId);
    });
  }, [concordanceData?.formOccurrences, currentSurahId, currentAyahId]);

  // Helper to fetch individual verse text & translation
  const fetchVersePreview = useCallback(async (surahId: number, ayahId: number) => {
    const key = `${surahId}:${ayahId}`;
    
    setPreviews(prev => ({
      ...prev,
      [key]: { words: [], translation: "", loading: true }
    }));

    try {
      const res = await fetch(`/data/quran/${surahId}.json`);
      if (!res.ok) throw new Error("Failed to fetch verse details");
      const json = await res.json();
      
      const verseObj = json.verses.find((v: any) => v.verse_number === ayahId);
      if (!verseObj) throw new Error(`Ayah ${ayahId} not found in Surah ${surahId}`);
      
      const translationObj = verseObj.translations.find((t: any) => t.resource_id === selectedTranslation);
      let translation = translationObj ? translationObj.text : "No translation available.";
      
      // Clean HTML tags and footnotes
      translation = translation.replace(/<sup[^>]*>.*?<\/sup>/g, "").replace(/<[^>]*>/g, "");

      setPreviews(prev => ({
        ...prev,
        [key]: { words: verseObj.words || [], translation, loading: false }
      }));
    } catch (err: any) {
      console.error(`Error fetching preview for ${key}:`, err);
      setPreviews(prev => ({
        ...prev,
        [key]: { words: [], translation: "", loading: false, error: err.message || "Failed to load" }
      }));
    }
  }, [selectedTranslation]);

  // Toggle preview state
  const togglePreview = useCallback((surahId: number, ayahId: number) => {
    const key = `${surahId}:${ayahId}`;
    
    setExpandedPreviews(prev => {
      const isExpanded = !prev[key];
      if (isExpanded) {
        // Trigger fetch asynchronously
        setPreviews(current => {
          if (!current[key] || current[key].error) {
            fetchVersePreview(surahId, ayahId);
          }
          return current;
        });
      }
      return {
        ...prev,
        [key]: isExpanded
      };
    });
  }, [fetchVersePreview]);

  // Previews are collapsed by default

  useEffect(() => {
    if (!word || !isOpen) return;

    // Reset states
    setActiveTab("morphology");
    setShowArabicMap({});
    setLexiconData(null);
    setConcordanceData(null);
    setPreviews({});
    setExpandedPreviews({});
    setLoading(true);

    async function fetchWordDetails() {
      try {
        const wordRoot = word!.root || null;
        const wordMorph = word!.morphology || [];
        
        let entries: any[] = [];
        let rootOccurrences: string[] = [];
        
        if (wordRoot) {
          let loadedLocally = false;
          try {
            const rootPath = encodeURIComponent(wordRoot);
            const res = await fetch(`/data/dictionary/${rootPath}.json`);
            if (res.ok) {
              const dictJson = await res.json();
              rootOccurrences = dictJson.occurrences || [];
              // Always load local definition so dictionary content never disappears
              entries = [{
                source_book: dictJson.source_book || 'ibn_faris',
                definition: dictJson.definition || '',
                definition_english: dictJson.definition_english || null
              }];
              if (dictJson.definition_english) {
                loadedLocally = true;
              }
            }
          } catch (e) {
            console.warn("Failed to load local dictionary for root", wordRoot, e);
          }

          // Fallback to live API if not loaded locally (to fetch/translate the definition)
          if (!loadedLocally) {
            try {
              if (entries.length > 0 && entries[0].definition) {
                // If we already have the local Arabic definition, send a stateless POST translation request
                const res = await fetch(`${API_BASE_URL}/api/query`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify({
                    type: "translate_root",
                    root: wordRoot,
                    definition: entries[0].definition
                  })
                });
                if (res.ok) {
                  const apiJson = await res.json();
                  if (apiJson && apiJson.definition_english) {
                    entries[0].definition_english = apiJson.definition_english;
                  }
                }
              } else if (word!.location) {
                // If local dictionary file didn't exist at all, fall back to querying by location (needs DB)
                const res = await fetch(`${API_BASE_URL}/api/query?type=root&location=${word!.location}`);
                if (res.ok) {
                  const apiJson = await res.json();
                  if (apiJson && apiJson.entries && apiJson.entries.length > 0) {
                    entries = apiJson.entries.map((ent: any) => ({
                      source_book: ent.source_book,
                      definition: ent.definition,
                      definition_english: ent.definition_english
                    }));
                  }
                }
              }
            } catch (e) {
              console.error("Failed to translate/fetch dictionary from live API", e);
            }
          }
        }
        
        setLexiconData({
          root: wordRoot,
          entries: entries,
          morphology: wordMorph
        });

        if (wordRoot || wordMorph.length > 0) {
          setConcordanceLoading(true);
          
          const stemPart = wordMorph.find((p) => ['N', 'V', 'ADJ', 'PN', 'STEM'].includes(p.tag)) || wordMorph[0];
          const formStr = stemPart ? stemPart.form.trim() : "";
          
          let formOccurrences: string[] = [];
          if (formStr) {
            try {
              let charSum = 0;
              for (let i = 0; i < formStr.length; i++) {
                charSum += formStr.charCodeAt(i);
              }
              const shardIdx = charSum % 100;
              
              const res = await fetch(`/data/forms/shard_${shardIdx}.json`);
              if (res.ok) {
                const shardJson = await res.json();
                formOccurrences = shardJson[formStr] || [];
              }
            } catch (e) {
              console.error("Failed to load local form occurrences shard", e);
            }
          }

          const occData = {
            root: wordRoot,
            form: formStr,
            rootOccurrences: rootOccurrences,
            formOccurrences: formOccurrences
          };
          
          setConcordanceData(occData);

          const [currentSurahStr, currentAyahStr] = word!.location.split(":");
          const cSId = parseInt(currentSurahStr, 10);
          const cAId = parseInt(currentAyahStr, 10);

          const hasOtherRoot = rootOccurrences.some((loc: string) => {
            const [s, a] = loc.split(":");
            return !(parseInt(s, 10) === cSId && parseInt(a, 10) === cAId);
          });
          const hasOtherForm = formOccurrences.some((loc: string) => {
            const [s, a] = loc.split(":");
            return !(parseInt(s, 10) === cSId && parseInt(a, 10) === cAId);
          });

          if (!hasOtherRoot && hasOtherForm) {
            setActiveConcTab("form");
          } else {
            setActiveConcTab("root");
          }
          setConcordanceLoading(false);
        }
      } catch (err) {
        console.error("Error fetching word info in BottomSheet:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchWordDetails();
  }, [word, isOpen]);

  if (!isOpen || !word) return null;

  const rootGrouped: OccurrenceGroup[] = filteredRootOccurrences.length > 0
    ? groupOccurrences(filteredRootOccurrences) 
    : [];
  const formGrouped: OccurrenceGroup[] = filteredFormOccurrences.length > 0
    ? groupOccurrences(filteredFormOccurrences) 
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center animate-fade-in bg-slate-950/60 backdrop-blur-xs">
      {/* Backdrop tap to close */}
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} />

      {/* Sheet panel */}
      <div className="relative w-full max-w-[480px] h-[80vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl border-t border-slate-200 dark:border-slate-800 animate-slide-up overflow-hidden z-10">
        
        {/* Drag handle decorator */}
        <div className="flex justify-center py-2.5">
          <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-arabic text-brand-emerald bg-brand-emerald/10 px-3 py-1 rounded-xl">
              {word.text_uthmani || word.text}
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-none">
                {word.transliteration.text}
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-mono">
                Location: {word.location}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("morphology")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 border-b-2 transition-all ${
              activeTab === "morphology"
                ? "border-brand-emerald text-brand-emerald bg-white dark:bg-slate-900/50"
                : "border-transparent text-slate-500 dark:text-slate-455 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <Layers size={14} />
            <span>Morphology</span>
          </button>
          
          <button
            onClick={() => setActiveTab("lexicon")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 border-b-2 transition-all ${
              activeTab === "lexicon"
                ? "border-brand-emerald text-brand-emerald bg-white dark:bg-slate-900/50"
                : "border-transparent text-slate-500 dark:text-slate-455 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <BookOpen size={14} />
            <span>Lexicon</span>
          </button>

          <button
            onClick={() => setActiveTab("concordance")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 border-b-2 transition-all ${
              activeTab === "concordance"
                ? "border-brand-emerald text-brand-emerald bg-white dark:bg-slate-900/50"
                : "border-transparent text-slate-500 dark:text-slate-455 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <LinkIcon size={14} />
            <span>Concordance</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full py-10 gap-3">
              <div className="w-10 h-10 border-3 border-slate-200 dark:border-slate-800 border-t-brand-emerald rounded-full animate-spin" />
              <p className="text-xs text-slate-400 dark:text-slate-500 animate-pulse">Analyzing word features...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: MORPHOLOGY */}
              {activeTab === "morphology" && (
                <div className="space-y-4">
                  {lexiconData?.morphology && lexiconData.morphology.length > 0 ? (
                    lexiconData.morphology.map((part, index) => {
                      const features = parseFeatureString(part.features, part.tag);
                      return (
                        <div 
                          key={part.part_id} 
                          className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 relative overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-indigo/3 dark:bg-brand-indigo/5 rounded-full blur-xl pointer-events-none" />
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-brand-indigo/10 text-brand-indigo font-mono">
                              Segment #{index + 1}
                            </span>
                            <span className="text-base font-arabic font-bold text-slate-700 dark:text-slate-350">
                              {part.form}
                            </span>
                          </div>

                          <div className="space-y-2">
                            {features.map((feat, fIdx) => (
                              <div key={fIdx} className="flex justify-between text-xs border-b border-slate-100/40 dark:border-slate-800/30 pb-1.5">
                                <span className="text-slate-400 dark:text-slate-500 font-medium">{feat.label}</span>
                                <span className="text-slate-700 dark:text-slate-300 font-semibold text-right">{feat.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 dark:text-slate-500">
                      <HelpCircle className="w-8 h-8 opacity-40 mb-2" />
                      <p className="text-sm">No morphological breakdown available for this particle.</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: LEXICON */}
              {activeTab === "lexicon" && (
                <div className="space-y-4">
                  {lexiconData?.root ? (
                    <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Arabic Root:</span>
                      <span className="text-xl font-arabic font-extrabold text-brand-emerald bg-brand-emerald/10 px-2.5 py-0.5 rounded-lg">
                        {lexiconData.root.split('').join(' ')}
                      </span>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-xs text-slate-400 dark:text-slate-500 text-center">
                      This word token has no derived Arabic root word (e.g. particle or pronoun).
                    </div>
                  )}

                  {lexiconData?.entries && lexiconData.entries.length > 0 ? (
                    <div className="space-y-4">
                      {lexiconData.entries.map((entry, idx) => {
                        const hasEnglish = !!entry.definition_english;
                        
                        return (
                          <div key={idx} className="p-4 border border-slate-150 dark:border-slate-800/80 rounded-2xl bg-white dark:bg-slate-950 shadow-xs">
                            <span className="text-[10px] font-bold text-brand-emerald uppercase tracking-widest block mb-2 font-mono">
                              {entry.source_book === 'lane' 
                                ? "Lane's Lexicon" 
                                : entry.source_book === 'ibn_faris' 
                                  ? "Ibn Faris (Maqayis al-Lughah)" 
                                  : entry.source_book}
                            </span>
                            
                            <div 
                              className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed font-sans prose dark:prose-invert max-w-none break-words whitespace-pre-line"
                              dangerouslySetInnerHTML={{ 
                                __html: hasEnglish ? entry.definition_english! : entry.definition 
                              }}
                            />
                            
                            {hasEnglish && (
                              <div className="mt-3 border-t border-slate-100 dark:border-slate-800/60 pt-2.5">
                                <button
                                  onClick={() => setShowArabicMap(prev => ({
                                    ...prev,
                                    [idx]: !prev[idx]
                                  }))}
                                  className="text-[10px] font-bold text-slate-450 dark:text-slate-500 hover:text-brand-emerald transition-colors cursor-pointer outline-hidden flex items-center gap-1"
                                >
                                  {showArabicMap[idx] ? "Hide Original Arabic" : "Show Original Arabic"}
                                </button>
                                
                                {showArabicMap[idx] && (
                                  <div className="mt-2.5 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100/50 dark:border-slate-800/40 rtl-text text-right text-sm text-slate-600 dark:text-slate-400 select-all font-arabic whitespace-pre-line leading-relaxed">
                                    {entry.definition}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : lexiconData?.root ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 dark:text-slate-500">
                      <BookOpen className="w-8 h-8 opacity-40 mb-2" />
                      <p className="text-sm">No dictionary definitions found for this root word.</p>
                    </div>
                  ) : null}
                </div>
              )}

              {/* TAB 3: CONCORDANCE */}
              {activeTab === "concordance" && (
                <div className="space-y-4">
                  {concordanceLoading ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-3">
                      <div className="w-6 h-6 border-2 border-slate-200 dark:border-slate-800 border-t-brand-emerald rounded-full animate-spin" />
                      <p className="text-xs text-slate-400 dark:text-slate-500">Finding occurrences...</p>
                    </div>
                  ) : (
                    <>
                      {/* Sub-tab selection */}
                      <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl text-xs font-semibold gap-1">
                        <button
                          onClick={() => setActiveConcTab("root")}
                          disabled={!concordanceData?.root || filteredRootOccurrences.length === 0}
                          className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                            activeConcTab === "root"
                              ? "bg-white dark:bg-slate-800 text-brand-emerald shadow-xs"
                              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-40"
                          }`}
                        >
                          Same Root ({filteredRootOccurrences.length})
                        </button>
                        <button
                          onClick={() => setActiveConcTab("form")}
                          disabled={!concordanceData?.form || filteredFormOccurrences.length === 0}
                          className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                            activeConcTab === "form"
                              ? "bg-white dark:bg-slate-800 text-brand-emerald shadow-xs"
                              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-40"
                          }`}
                        >
                          Same Form ({filteredFormOccurrences.length})
                        </button>
                      </div>

                      {/* Occurrences list */}
                      <div className="space-y-3 mt-4">
                        {filteredRootOccurrences.length === 0 && filteredFormOccurrences.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-455 dark:text-slate-500">
                            <BookOpen className="w-8 h-8 opacity-30 mb-2" />
                            <p className="text-xs max-w-[280px]">This word has no other occurrences of the same root or form in the Quran.</p>
                          </div>
                        ) : (
                          <>
                            {activeConcTab === "root" && !concordanceData?.root && (
                              <p className="text-xs text-center text-slate-400 dark:text-slate-500 py-4">
                                No root information to track.
                              </p>
                            )}
                            
                            {activeConcTab === "form" && !concordanceData?.form && (
                              <p className="text-xs text-center text-slate-400 dark:text-slate-500 py-4">
                                No form information to track.
                              </p>
                            )}

                            {((activeConcTab === "root" && filteredRootOccurrences.length > 0) || 
                              (activeConcTab === "form" && filteredFormOccurrences.length > 0)) && (
                              <div className="space-y-2.5 max-h-[40vh] overflow-y-auto pr-1">
                                {(activeConcTab === "root" ? rootGrouped : formGrouped).map((group) => (
                                  <div key={group.surahId} className="p-3 border border-slate-100 dark:border-slate-800/80 rounded-xl bg-slate-50/50 dark:bg-slate-900/40">
                                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5">
                                      Surah {group.surahName}
                                    </span>
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                      {group.ayahs.map((ayahId) => {
                                        const key = `${group.surahId}:${ayahId}`;
                                        const isExpanded = !!expandedPreviews[key];
                                        return (
                                          <button
                                            key={ayahId}
                                            onClick={() => togglePreview(group.surahId, ayahId)}
                                            className={`text-xs px-2.5 py-1 rounded-md border transition-all cursor-pointer flex items-center gap-1 active:scale-95 ${
                                              isExpanded 
                                                ? "bg-brand-indigo text-white border-brand-indigo font-semibold" 
                                                : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-brand-indigo font-semibold hover:border-brand-indigo/50"
                                            }`}
                                          >
                                            <span>Ayah {ayahId}</span>
                                            {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                          </button>
                                        );
                                      })}
                                    </div>

                                    {/* Previews container for this Surah */}
                                    <div className="space-y-2">
                                      {group.ayahs.map((ayahId) => {
                                        const key = `${group.surahId}:${ayahId}`;
                                        const isExpanded = !!expandedPreviews[key];
                                        const preview = previews[key];

                                        if (!isExpanded) return null;

                                        return (
                                          <div key={ayahId} className="p-3 mt-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-850/80 shadow-xs space-y-2 animate-fade-in">
                                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 pb-1.5">
                                              <span className="text-[10px] font-bold text-brand-indigo uppercase font-mono">
                                                Ayah {ayahId} Context
                                              </span>
                                              <button
                                                onClick={() => togglePreview(group.surahId, ayahId)}
                                                className="text-[10px] text-slate-400 hover:text-slate-650 dark:hover:text-slate-250 cursor-pointer"
                                              >
                                                Close
                                              </button>
                                            </div>

                                            {preview?.loading ? (
                                              <div className="flex items-center justify-center py-4">
                                                <Loader2 className="w-5 h-5 text-brand-emerald animate-spin" />
                                              </div>
                                            ) : preview?.error ? (
                                              <p className="text-[11px] text-red-500 font-medium py-1">{preview.error}</p>
                                            ) : (
                                              <>
                                                {(() => {
                                                  const matchingWords = preview?.words?.filter((w: any) => {
                                                    if (w.char_type_name !== "word" || !w.location) return false;
                                                    return activeConcTab === "root"
                                                      ? concordanceData?.rootOccurrences.includes(w.location)
                                                      : concordanceData?.formOccurrences.includes(w.location);
                                                  }) || [];

                                                  return (
                                                    <>
                                                      <div 
                                                        className="text-right font-arabic text-slate-800 dark:text-slate-150 text-base leading-loose select-all rtl-text font-medium" 
                                                        dir="rtl"
                                                      >
                                                        {preview?.words
                                                          ?.filter((w: any) => w.char_type_name === "word" || w.char_type_name === "end")
                                                          ?.map((w: any, wIdx: number) => {
                                                            const isMatching = w.location && (activeConcTab === "root"
                                                              ? concordanceData?.rootOccurrences.includes(w.location)
                                                              : concordanceData?.formOccurrences.includes(w.location));

                                                            return (
                                                              <span key={w.id}>
                                                                {wIdx > 0 && " "}
                                                                <span 
                                                                  className={isMatching 
                                                                    ? "text-brand-emerald bg-brand-emerald/10 dark:bg-brand-emerald/25 px-1 py-0.5 rounded-md font-bold transition-all" 
                                                                    : ""
                                                                  }
                                                                >
                                                                  {w.text_uthmani || w.text}
                                                                </span>
                                                              </span>
                                                            );
                                                          })
                                                        }
                                                      </div>
                                                      <p 
                                                        className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed font-sans mt-1.5 whitespace-pre-line"
                                                        dangerouslySetInnerHTML={{
                                                          __html: highlightTranslationText(preview?.translation, matchingWords)
                                                        }}
                                                      />
                                                    </>
                                                  );
                                                })()}
                                                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-900">
                                                  <button
                                                    onClick={() => {
                                                      onNavigateAyah(group.surahId, ayahId);
                                                      onClose();
                                                    }}
                                                    className="text-[10px] font-bold text-white bg-brand-emerald hover:bg-brand-emerald/90 px-3 py-1 rounded-lg transition-colors cursor-pointer active:scale-95"
                                                  >
                                                    Jump to Verse
                                                  </button>
                                                  <button
                                                    onClick={() => togglePreview(group.surahId, ayahId)}
                                                    className="text-[10px] font-bold text-slate-450 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-350 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                                                  >
                                                    Collapse
                                                  </button>
                                                </div>
                                              </>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                                {(activeConcTab === "root" ? rootGrouped : formGrouped).length === 0 && (
                                  <p className="text-xs text-center text-slate-400 py-4">No matches found.</p>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
