import { useState } from "react";
import type { Verse, Word } from "../lib/types";
import { HelpCircle, Layers } from "lucide-react";

interface AyahReaderProps {
  verseData: Verse | null;
  loading: boolean;
  error: string;
  clickedWord: Word | null;
  onWordClick: (word: Word) => void;
  translationId: number;
}

export default function AyahReader({
  verseData,
  loading,
  error,
  clickedWord,
  onWordClick,
  translationId,
}: AyahReaderProps) {
  const [showIrab, setShowIrab] = useState<boolean>(false);
  
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 border-4 border-slate-200 dark:border-slate-800 border-t-brand-emerald rounded-full animate-spin" />
        <p className="text-sm text-slate-500 dark:text-slate-400 animate-pulse">Loading Ayah text...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 my-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl text-red-700 dark:text-red-400 text-sm text-center">
        {error}
      </div>
    );
  }

  if (!verseData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500 text-center">
        <HelpCircle size={36} className="opacity-40 mb-2" />
        <p className="text-sm">Select a Surah and Ayah to begin studying.</p>
      </div>
    );
  }

  // Get selected translation
  const translationObj = verseData.translations.find(t => t.resource_id === translationId);
  const translationText = translationObj
    ? translationObj.text.replace(/<sup[^>]*>.*?<\/sup>/g, "").replace(/<[^>]*>/g, "")
    : "Translation not available.";

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* 1. Large Unified Arabic Text Box */}
      <div className="glass-card rounded-2xl p-5 md:p-6 border border-slate-200 dark:border-slate-800/80 shadow-xs relative overflow-hidden bg-white/50 dark:bg-slate-900/40">
        <div className="absolute top-0 right-0 w-36 h-36 bg-brand-emerald/3 dark:bg-brand-emerald/5 rounded-full blur-2xl pointer-events-none" />
        <div className="rtl-text text-right text-3xl md:text-4xl text-slate-900 dark:text-white leading-loose select-all font-arabic">
          {verseData.words.map(w => w.text_uthmani || w.text).join(" ")}
        </div>
      </div>

      {/* 2. Unified English Translation Box */}
      <div className="px-1.5 flex flex-col gap-3">
        <div>
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-widest block mb-1">
            {translationId === 85 
              ? "Abdel Haleem" 
              : translationId === 131 
                ? "Mustafa Khattab (The Clear Quran)" 
                : translationId === 203 
                  ? "Muhammad Asad" 
                  : "Translation"}
          </span>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-sans font-medium italic">
            "{translationText}"
          </p>
        </div>

        {/* Subtle I'rab Toggle */}
        {verseData.irab && (
          <div>
            <button
              onClick={() => setShowIrab(!showIrab)}
              className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-brand-emerald dark:text-slate-450 dark:hover:text-brand-emerald transition-colors cursor-pointer outline-hidden mt-1"
            >
              <Layers size={13} />
              <span>{showIrab ? "Hide Verse Grammar (I'rab)" : "Show Verse Grammar (I'rab)"}</span>
            </button>
            
            {showIrab && (
              <div className="mt-2.5 p-4 rounded-2xl bg-slate-550/5 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800/40 rtl-text text-right text-base text-slate-900 dark:text-slate-100 font-arabic whitespace-pre-line leading-loose select-all">
                {verseData.irab}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-100 dark:bg-slate-800/60 my-2" />

      {/* 3. Word-by-Word Grid Selector */}
      <div className="flex flex-col gap-3">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Word Breakdown (Tap to analyze)
        </h3>
        
        <div className="flex flex-row-reverse flex-wrap gap-2 bg-slate-550/5 dark:bg-slate-950/20 p-3 rounded-2xl border border-slate-200/50 dark:border-slate-800/40 justify-start">
          {verseData.words
            .filter((word) => word.char_type_name !== "end")
            .map((word) => {
              const isSelected = clickedWord?.id === word.id;
              
              return (
                <button
                  key={word.id}
                  onClick={() => onWordClick(word)}
                  className={`flex flex-col items-center p-2 rounded-xl transition-all duration-150 select-none cursor-pointer outline-hidden border active:scale-95 ${
                    isSelected 
                      ? "bg-brand-emerald text-white border-brand-emerald shadow-md shadow-brand-emerald/15" 
                      : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-850/80 text-slate-800 dark:text-slate-200 hover:border-brand-emerald/50"
                  }`}
                >
                  {/* Arabic word token */}
                  <span className="text-lg font-arabic mb-1 leading-normal">
                    {word.text_uthmani || word.text}
                  </span>
                  
                  {/* Metadata tokens */}
                  <div className="flex flex-col items-center gap-0.5 text-center">
                    <span className={`text-[9px] font-mono leading-none tracking-tight ${isSelected ? "text-emerald-100" : "text-slate-450 dark:text-slate-500"}`}>
                      {word.transliteration.text}
                    </span>
                    <span className={`text-[10px] font-medium leading-tight mt-1 max-w-[90px] whitespace-normal break-words text-center ${isSelected ? "text-white" : "text-slate-600 dark:text-slate-400"}`}>
                      {word.translation.text}
                    </span>
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
