import { useState, useEffect } from "react";
import type { TafseerRow } from "../lib/types";
import { Sparkles, BookOpen, AlertCircle, RefreshCw } from "lucide-react";
import { API_BASE_URL } from "../lib/api";

interface TafseerTabProps {
  surahId: number;
  ayahId: number;
  verseText: string;
  tafsirs: TafseerRow[];
}

export default function TafseerTab({ surahId, ayahId, verseText, tafsirs: localTafsirs }: TafseerTabProps) {
  const [tafsirs, setTafsirs] = useState<TafseerRow[]>([]);
  const [tafsirsLoading, setTafsirsLoading] = useState<boolean>(false);
  const [tafsirsError, setTafsirsError] = useState<string>("");

  const [geminiSummary, setGeminiSummary] = useState<string>("");
  const [geminiLoading, setGeminiLoading] = useState<boolean>(false);
  const [geminiError, setGeminiError] = useState<string>("");

  const [activeBook, setActiveBook] = useState<"ai" | "jalalayn" | "ibn_kathir" | "ibn_ashur" | "qurtubi">("ai");

  useEffect(() => {
    setTafsirs(localTafsirs || []);
    setTafsirsLoading(false);
    setTafsirsError("");
    setGeminiError("");
    setActiveBook("ai"); // default back to AI tab

    // Check local cache for synthesized exegesis
    const cached = localStorage.getItem(`gemini-summary:${surahId}:${ayahId}`);
    if (cached) {
      setGeminiSummary(cached);
    } else {
      setGeminiSummary("");
      // Try fetching static pre-exported JSON file
      checkStaticJson();
    }

    async function checkStaticJson() {
      let foundStatic = false;
      try {
        const res = await fetch(`/data/ai_summaries/${surahId}_${ayahId}.json`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.summary) {
            setGeminiSummary(data.summary);
            localStorage.setItem(`gemini-summary:${surahId}:${ayahId}`, data.summary);
            foundStatic = true;
          }
        }
      } catch (e) {
        // Ignore fallback
      }

      // If not found in static JSON, fall back to checking the cloud database cache
      if (!foundStatic && API_BASE_URL) {
        try {
          const res = await fetch(`${API_BASE_URL}/api/gemini?surah_id=${surahId}&ayah_id=${ayahId}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.summary) {
              setGeminiSummary(data.summary);
              localStorage.setItem(`gemini-summary:${surahId}:${ayahId}`, data.summary);
            }
          }
        } catch (e) {
          console.warn("Failed to check cloud database cache:", e);
        }
      }
    }
  }, [surahId, ayahId, localTafsirs]);

  const generateGeminiSummary = async (force: boolean = false) => {
    setGeminiLoading(true);
    setGeminiError("");
    setGeminiSummary("");

    try {
      let activeVerseText = verseText;
      if (!activeVerseText) {
        try {
          const res = await fetch(`/data/quran/${surahId}.json`);
          if (res.ok) {
            const json = await res.json();
            const verseObj = json.verses.find((v: any) => v.verse_number === ayahId);
            if (verseObj && verseObj.words) {
              activeVerseText = verseObj.words
                .filter((w: any) => w.char_type_name === "word")
                .map((w: any) => w.text_uthmani || w.text)
                .join(" ");
            }
          }
        } catch (e) {
          console.warn("Failed to load fallback verse text from local JSON", e);
        }
      }

      const ibnAshurContent = localTafsirs.find(t => t.source_book === "ibn_ashur")?.content || "";
      const qurtubiContent = localTafsirs.find(t => t.source_book === "qurtubi")?.content || "";

      const res = await fetch(`${API_BASE_URL}/api/gemini`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          surah_id: surahId,
          ayah_id: ayahId,
          verse_text: activeVerseText || "",
          ibn_ashur: ibnAshurContent,
          qurtubi: qurtubiContent,
          force: force
        })
      });
      if (!res.ok) throw new Error("Gemini service failed.");
      const data = await res.json();
      if (data.error) {
        setGeminiError(data.error);
      } else {
        localStorage.setItem(`gemini-summary:${surahId}:${ayahId}`, data.summary);
        setGeminiSummary(data.summary);
      }
    } catch (err) {
      setGeminiError("Failed to synthesize AI exegesis. Please verify API key setup.");
    } finally {
      setGeminiLoading(false);
    }
  };

  const getBookContent = (bookId: string) => {
    const row = tafsirs.find(t => t.source_book === bookId);
    return row ? row.content : "This exegesis section was not found in the database for this ayah.";
  };

  // Simple Markdown renderer
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    
    const lines = text.split("\n");
    const renderedElements = lines.map((line, idx) => {
      const trimmed = line.trim();
      
      if (trimmed.startsWith("###")) {
        return (
          <h4 key={idx} className="text-sm font-bold text-brand-emerald mt-3 mb-1.5 font-sans">
            {trimmed.replace("###", "").trim()}
          </h4>
        );
      }
      if (trimmed.startsWith("##")) {
        return (
          <h3 key={idx} className="text-base font-bold text-brand-indigo mt-4 mb-2 font-sans">
            {trimmed.replace("##", "").trim()}
          </h3>
        );
      }
      
      if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
        const cleanContent = trimmed.substring(1).trim().replace(/\*\*(.*?)\*\*/g, "$1");
        return (
          <li key={idx} className="ml-4 list-disc text-xs text-slate-600 dark:text-slate-355 leading-relaxed mb-1 font-sans">
            {cleanContent}
          </li>
        );
      }
      
      if (!trimmed) return <div key={idx} className="h-1.5" />;
      
      const formattedLine = trimmed.replace(/\*\*(.*?)\*\*/g, "$1");
      return (
        <p key={idx} className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-2 font-sans">
          {formattedLine}
        </p>
      );
    });
    
    return <div className="space-y-0.5">{renderedElements}</div>;
  };

  const hasJalalayn = tafsirs.some(t => t.source_book === "jalalayn");
  const hasIbnAshur = tafsirs.some(t => t.source_book === "ibn_ashur");
  const hasQurtubi = tafsirs.some(t => t.source_book === "qurtubi");
  const hasIbnKathir = tafsirs.some(t => t.source_book === "ibn_kathir");

  return (
    <div className="flex flex-col h-full gap-4 animate-fade-in">
      {/* Tab Selectors */}
      <div className="flex overflow-x-auto scrollbar-none bg-slate-100 dark:bg-slate-950 p-1 rounded-xl text-xs font-semibold gap-1">
        <button
          onClick={() => setActiveBook("ai")}
          className={`flex-none px-3 py-2 rounded-lg text-center flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeBook === "ai"
              ? "bg-white dark:bg-slate-850 text-brand-emerald shadow-xs"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          <Sparkles size={13} />
          <span>AI Synthesis</span>
        </button>
        <button
          onClick={() => setActiveBook("jalalayn")}
          disabled={tafsirsLoading || !hasJalalayn}
          className={`flex-none px-3 py-2 rounded-lg text-center flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeBook === "jalalayn"
              ? "bg-white dark:bg-slate-850 text-brand-indigo shadow-xs"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-40"
          }`}
        >
          <BookOpen size={13} />
          <span>Jalalayn (EN)</span>
        </button>
        <button
          onClick={() => setActiveBook("ibn_kathir")}
          disabled={tafsirsLoading || !hasIbnKathir}
          className={`flex-none px-3 py-2 rounded-lg text-center flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeBook === "ibn_kathir"
              ? "bg-white dark:bg-slate-850 text-brand-indigo shadow-xs"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-40"
          }`}
        >
          <BookOpen size={13} />
          <span>Ibn Kathir (EN)</span>
        </button>
        <button
          onClick={() => setActiveBook("ibn_ashur")}
          disabled={tafsirsLoading || !hasIbnAshur}
          className={`flex-none px-3 py-2 rounded-lg text-center flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeBook === "ibn_ashur"
              ? "bg-white dark:bg-slate-850 text-brand-indigo shadow-xs"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-40"
          }`}
        >
          <BookOpen size={13} />
          <span>Ibn Ashur (AR)</span>
        </button>
        <button
          onClick={() => setActiveBook("qurtubi")}
          disabled={tafsirsLoading || !hasQurtubi}
          className={`flex-none px-3 py-2 rounded-lg text-center flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeBook === "qurtubi"
              ? "bg-white dark:bg-slate-850 text-brand-indigo shadow-xs"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-40"
          }`}
        >
          <BookOpen size={13} />
          <span>Al-Qurtubi (AR)</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto px-1">
        {/* AI Synthesis Tab */}
        {activeBook === "ai" && (
          <div className="space-y-4">
            <div className="bg-brand-emerald/5 dark:bg-brand-emerald/10 border border-brand-emerald/20 p-4 rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-brand-emerald/10 rounded-full blur-xl pointer-events-none" />
              <h3 className="text-xs font-bold text-brand-emerald flex items-center gap-1.5 mb-2 font-sans">
                <Sparkles size={14} />
                <span>AI Exegesis Synthesis (Gemini)</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-sans mb-3">
                Synthesize the classical Arabic commentaries of Ibn Ashur and Al-Qurtubi into a unified, source-disciplined English summary using Google Gemini.
              </p>
              
              {!geminiSummary && !geminiLoading && (
                <button
                  onClick={() => generateGeminiSummary(false)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-brand-emerald text-white text-xs font-bold hover:bg-brand-emerald-dark shadow-xs shadow-brand-emerald/20 transition-all cursor-pointer active:scale-97"
                >
                  <Sparkles size={13} />
                  <span>Generate AI Summary</span>
                </button>
              )}

              {geminiLoading && (
                <div className="flex items-center justify-center py-4 gap-2 text-brand-emerald">
                  <RefreshCw size={14} className="animate-spin" />
                  <span className="text-xs font-bold animate-pulse">Analyzing traditions...</span>
                </div>
              )}

              {geminiError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl text-red-700 dark:text-red-400 text-xs font-sans">
                  <AlertCircle size={14} />
                  <span>{geminiError}</span>
                </div>
              )}
            </div>

            {geminiSummary && (
              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950/40 animate-fade-in shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5 mb-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                    Generated Commentary
                  </span>
                  <button
                    onClick={() => generateGeminiSummary(true)}
                    className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650 dark:hover:text-slate-250 transition-colors"
                    title="Regenerate Summary"
                  >
                    <RefreshCw size={12} />
                  </button>
                </div>
                <div className="space-y-1">
                  {renderMarkdown(geminiSummary)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Classical commentators tabs */}
        {activeBook !== "ai" && (
          <div className="animate-fade-in">
            {tafsirsLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-8 h-8 border-3 border-slate-200 dark:border-slate-850 border-t-brand-indigo rounded-full animate-spin" />
                <p className="text-xs text-slate-400 dark:text-slate-500">Retrieving commentary text...</p>
              </div>
            ) : tafsirsError ? (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl text-red-700 dark:text-red-450 text-xs text-center font-sans">
                {tafsirsError}
              </div>
            ) : (
              <div className="p-4 border border-slate-150 dark:border-slate-800/80 rounded-2xl bg-white dark:bg-slate-950/40 relative">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3 font-mono">
                  Source tradition: {
                    activeBook === "ibn_ashur" ? "Al-Tahrir wa al-Tanwir (Ibn Ashur) - Arabic" :
                    activeBook === "qurtubi" ? "Tafsir al-Qurtubi - Arabic" :
                    activeBook === "jalalayn" ? "Tafsir al-Jalalayn - English" :
                    activeBook === "ibn_kathir" ? "Tafsir Ibn Kathir - English" :
                    activeBook
                  }
                </span>
                
                {activeBook === "ibn_kathir" || activeBook === "jalalayn" ? (
                  <div className="text-xs md:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-sans whitespace-pre-wrap select-all">
                    {getBookContent(activeBook)}
                  </div>
                ) : (
                  <div className="rtl-text text-right text-lg md:text-xl text-slate-900 dark:text-slate-100 leading-loose select-all font-arabic whitespace-pre-line">
                    {getBookContent(activeBook)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
