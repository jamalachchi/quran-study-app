import { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { API_BASE_URL } from "../lib/api";

interface IrabTabProps {
  surahId: number;
  ayahId: number;
  verseText: string;
  irab?: string | null;
}

export default function IrabTab({ surahId, ayahId, verseText, irab }: IrabTabProps) {
  const [irabText, setIrabText] = useState<string>(irab || "");
  const [loading, setLoading] = useState<boolean>(!irab);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (irab) {
      setIrabText(irab);
      setLoading(false);
      setError("");
      return;
    }

    setIrabText("");
    setLoading(true);
    setError("");

    async function fetchIrab() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/irab?surah_id=${surahId}&ayah_id=${ayahId}&verse_text=${encodeURIComponent(verseText)}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("I'rab grammatical analysis not found in the database for this ayah.");
          }
          throw new Error("Failed to load I'rab grammatical analysis.");
        }
        const data = await res.json();
        setIrabText(data.irab || "");
      } catch (err: any) {
        console.error(err);
        setError(err.message || "An error occurred loading grammar details.");
      } finally {
        setLoading(false);
      }
    }

    if (verseText) {
      fetchIrab();
    }
  }, [surahId, ayahId, verseText, irab]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-8 h-8 border-3 border-slate-200 dark:border-slate-850 border-t-brand-indigo rounded-full animate-spin" />
        <p className="text-xs text-slate-400 dark:text-slate-500">Retrieving grammatical analysis...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl">
        <AlertCircle size={24} className="text-slate-400 dark:text-slate-500 mb-2" />
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="p-4 border border-slate-150 dark:border-slate-800/80 rounded-2xl bg-white dark:bg-slate-950/40">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5 mb-4">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
            Classical Grammatical Syntax (إعراب القرآن)
          </span>
          <span className="text-[10px] font-bold text-brand-indigo uppercase tracking-wider bg-brand-indigo/10 px-2 py-0.5 rounded-md font-sans">
            Qasim Da'as
          </span>
        </div>
        
        <div className="rtl-text text-right text-lg md:text-xl text-slate-900 dark:text-slate-100 leading-loose select-all font-arabic whitespace-pre-line">
          {irabText}
        </div>
      </div>
    </div>
  );
}
