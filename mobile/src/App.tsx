import { useState, useEffect, useCallback, useRef } from "react";
import { CHAPTERS } from "./lib/chapters";
import type { Verse, Word } from "./lib/types";
import AyahReader from "./components/AyahReader";
import TafseerTab from "./components/TafseerTab";
import IrabTab from "./components/IrabTab";
import BottomSheet from "./components/BottomSheet";
import Logo from "./components/Logo";
import { RECITERS } from "./lib/utils";
import { 
  Sparkles, 
  Layers, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  Volume2,
  Languages,
  Square
} from "lucide-react";

export default function App() {
  // Navigation states
  const [selectedSurah, setSelectedSurah] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("selectedSurah");
      return saved ? parseInt(saved, 10) : 1;
    }
    return 1;
  });
  const [selectedAyah, setSelectedAyah] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("selectedAyah");
      return saved ? parseInt(saved, 10) : 1;
    }
    return 1;
  });
  const [ayahCount, setAyahCount] = useState<number>(() => {
    let surahId = 1;
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("selectedSurah");
      if (saved) surahId = parseInt(saved, 10);
    }
    const chapter = CHAPTERS.find((c) => c.id === surahId);
    return chapter ? chapter.verses_count : 7;
  });
  const [activeTab, setActiveTab] = useState<"quran" | "tafseer" | "irab">("quran");
  
  // Translation preference (20 = Saheeh International, 85 = Abdel Haleem, 149 = Bridges)
  const [selectedTranslation, setSelectedTranslation] = useState<number>(20);

  // Verse data states
  const [verseData, setVerseData] = useState<Verse | null>(null);
  const [verseLoading, setVerseLoading] = useState<boolean>(true);
  const [verseError, setVerseError] = useState<string>("");

  // Bottom Sheet states
  const [clickedWord, setClickedWord] = useState<Word | null>(null);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState<boolean>(false);

  // Audio recitation states
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingFullAudio, setIsPlayingFullAudio] = useState<boolean>(false);

  // Audio Download Manager states
  const [isAudioOffline, setIsAudioOffline] = useState<boolean>(false);
  const [isDownloadingAudio, setIsDownloadingAudio] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);

  const [selectedReciter, setSelectedReciter] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("selectedReciter");
      return saved || "Husary_64kbps";
    }
    return "Husary_64kbps";
  });

  // Persist preferences
  useEffect(() => {
    localStorage.setItem("selectedSurah", selectedSurah.toString());
  }, [selectedSurah]);

  useEffect(() => {
    localStorage.setItem("selectedAyah", selectedAyah.toString());
  }, [selectedAyah]);

  useEffect(() => {
    localStorage.setItem("selectedReciter", selectedReciter);
  }, [selectedReciter]);

  // Update verse list length when Surah changes
  useEffect(() => {
    const chapter = CHAPTERS.find((c) => c.id === selectedSurah);
    if (chapter) {
      setAyahCount(chapter.verses_count);
      if (selectedAyah > chapter.verses_count) {
        setSelectedAyah(1);
      }
    }
  }, [selectedSurah]);

  // Touch swipe detection for verse navigation
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isBottomSheetOpen) return;
    if (touchStartX.current === null || touchStartY.current === null) return;

    const diffX = e.changedTouches[0].clientX - touchStartX.current;
    const diffY = e.changedTouches[0].clientY - touchStartY.current;

    // Clear values
    touchStartX.current = null;
    touchStartY.current = null;

    // Minimum distance threshold to register a swipe (e.g. 60px)
    const threshold = 60;
    // Maximum vertical offset to avoid registering diagonal scrolls as swipes (e.g. 50px)
    const verticalThreshold = 50;

    const target = e.target as HTMLElement;
    if (target.closest('select') || target.closest('button') || target.closest('input')) {
      return;
    }

    if (Math.abs(diffX) > threshold && Math.abs(diffY) < verticalThreshold) {
      if (diffX > 0) {
        // Swipe Right -> Prev Ayah
        handlePrevAyah();
      } else {
        // Swipe Left -> Next Ayah
        handleNextAyah();
      }
    }
  };

  // Check offline audio cache status
  const checkAudioOfflineStatus = useCallback(async (surahId: number, reciterId: string) => {
    try {
      const chapter = CHAPTERS.find((c) => c.id === surahId);
      const versesCount = chapter ? chapter.verses_count : 0;
      if (versesCount === 0 || typeof caches === "undefined") {
        setIsAudioOffline(false);
        return;
      }
      
      const cache = await caches.open(`quran-audio-${reciterId}`);
      const pad = (num: number, size: number) => {
        let s = num + "";
        while (s.length < size) s = "0" + s;
        return s;
      };

      let allFound = true;
      for (let i = 1; i <= versesCount; i++) {
        const audioUrl = `https://mirrors.quranicaudio.com/everyayah/${reciterId}/${pad(surahId, 3)}${pad(i, 3)}.mp3`;
        const match = await cache.match(audioUrl);
        if (!match) {
          allFound = false;
          break;
        }
      }
      setIsAudioOffline(allFound);
    } catch (e) {
      console.error("Failed to check cache status", e);
      setIsAudioOffline(false);
    }
  }, []);

  useEffect(() => {
    checkAudioOfflineStatus(selectedSurah, selectedReciter);
  }, [selectedSurah, selectedReciter, checkAudioOfflineStatus]);

  // Download Surah audio
  const downloadSurahAudio = async (surahId: number) => {
    setIsDownloadingAudio(true);
    setDownloadProgress(0);
    try {
      const chapter = CHAPTERS.find((c) => c.id === surahId);
      const versesCount = chapter ? chapter.verses_count : 0;
      if (versesCount === 0 || typeof caches === "undefined") return;

      const cache = await caches.open(`quran-audio-${selectedReciter}`);
      const pad = (num: number, size: number) => {
        let s = num + "";
        while (s.length < size) s = "0" + s;
        return s;
      };

      for (let i = 1; i <= versesCount; i++) {
        const audioUrl = `https://mirrors.quranicaudio.com/everyayah/${selectedReciter}/${pad(surahId, 3)}${pad(i, 3)}.mp3`;
        
        const match = await cache.match(audioUrl);
        if (!match) {
          const res = await fetch(audioUrl, { mode: 'cors' });
          if (res.ok) {
            await cache.put(audioUrl, res.clone());
          } else {
            throw new Error(`Failed to download verse ${i}`);
          }
          // Throttle requests slightly (80ms) to prevent CDN rate limits
          await new Promise((resolve) => setTimeout(resolve, 80));
        }
        setDownloadProgress(Math.round((i / versesCount) * 100));
      }
      setIsAudioOffline(true);
    } catch (e) {
      console.error("Failed to download Surah audio", e);
      alert("Download failed. Please check your internet connection.");
    } finally {
      setIsDownloadingAudio(false);
      setDownloadProgress(0);
    }
  };

  // Delete Surah audio
  const deleteSurahAudio = async (surahId: number) => {
    if (!window.confirm("Are you sure you want to delete the offline audio for this Surah?")) {
      return;
    }
    
    try {
      const chapter = CHAPTERS.find((c) => c.id === surahId);
      const versesCount = chapter ? chapter.verses_count : 0;
      if (versesCount === 0 || typeof caches === "undefined") return;

      const cache = await caches.open(`quran-audio-${selectedReciter}`);
      const pad = (num: number, size: number) => {
        let s = num + "";
        while (s.length < size) s = "0" + s;
        return s;
      };

      for (let i = 1; i <= versesCount; i++) {
        const audioUrl = `https://mirrors.quranicaudio.com/everyayah/${selectedReciter}/${pad(surahId, 3)}${pad(i, 3)}.mp3`;
        await cache.delete(audioUrl);
      }
      setIsAudioOffline(false);
    } catch (e) {
      console.error("Failed to delete Surah audio", e);
    }
  };

  // Fetch verse details
  const fetchVerseDetails = useCallback(async (surah: number, ayah: number) => {
    setVerseLoading(true);
    setVerseError("");

    try {
      const res = await fetch(`/data/quran/${surah}.json`);
      if (!res.ok) {
        throw new Error(`Failed to load offline Quran data for Surah ${surah}. Make sure you run the export script.`);
      }
      const data = await res.json();
      const verseObj = data.verses.find((v: any) => v.verse_number === ayah);
      if (!verseObj) {
        throw new Error(`Ayah ${ayah} not found in Surah ${surah} data.`);
      }
      setVerseData(verseObj);
    } catch (err: any) {
      console.error(err);
      setVerseError(err.message || "An error occurred while loading verse details.");
    } finally {
      setVerseLoading(false);
    }
  }, []);

  // Play audio for a specific verse
  const playAudioForVerse = useCallback(async (surah: number, ayah: number) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const pad = (num: number, size: number) => {
      let s = num + "";
      while (s.length < size) s = "0" + s;
      return s;
    };
    const audioUrl = `https://mirrors.quranicaudio.com/everyayah/${selectedReciter}/${pad(surah, 3)}${pad(ayah, 3)}.mp3`;

    try {
      const cache = await caches.open(`quran-audio-${selectedReciter}`);
      const cachedResponse = await cache.match(audioUrl);
      
      let playUrl = audioUrl;
      if (cachedResponse) {
        const blob = await cachedResponse.blob();
        playUrl = URL.createObjectURL(blob);
      }

      const audio = new Audio(playUrl);
      audioRef.current = audio;
      setIsPlayingFullAudio(true);

      audio.play().catch((e) => {
        console.error("Failed to play recitation", e);
        setIsPlayingFullAudio(false);
      });

      audio.onended = () => {
        setIsPlayingFullAudio(false);
        if (cachedResponse) {
          URL.revokeObjectURL(playUrl);
        }
      };
    } catch (e) {
      console.warn("Cache lookup failed, streaming online:", e);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      setIsPlayingFullAudio(true);
      audio.play().catch((err) => {
        console.error("Failed to play online recitation", err);
        setIsPlayingFullAudio(false);
      });
      audio.onended = () => {
        setIsPlayingFullAudio(false);
      };
    }
  }, [selectedReciter]);

  // Trigger fetch when Surah/Ayah changes
  useEffect(() => {
    fetchVerseDetails(selectedSurah, selectedAyah);
    setClickedWord(null);
    setIsBottomSheetOpen(false);

    // Stop active audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlayingFullAudio(false);
    }
  }, [selectedSurah, selectedAyah, fetchVerseDetails]);

  // Handle reciter change during active playback (clean fallback)
  useEffect(() => {
    if (isPlayingFullAudio && audioRef.current) {
      playAudioForVerse(selectedSurah, selectedAyah);
    }
  }, [playAudioForVerse, selectedSurah, selectedAyah]);

  const handlePlayRecitation = useCallback(() => {
    if (isPlayingFullAudio && audioRef.current) {
      audioRef.current.pause();
      setIsPlayingFullAudio(false);
      return;
    }

    playAudioForVerse(selectedSurah, selectedAyah);
  }, [selectedSurah, selectedAyah, isPlayingFullAudio, playAudioForVerse]);

  const handleStopRecitation = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlayingFullAudio(false);
  }, []);

  const handleWordClick = (word: Word) => {
    // Play WBW audio on tap
    if (word.location) {
      const parts = word.location.split(':');
      if (parts.length === 3) {
        const padVal = (num: number | string, size: number) => {
          let s = num + "";
          while (s.length < size) s = "0" + s;
          return s;
        };
        const sP = padVal(parts[0], 3);
        const aP = padVal(parts[1], 3);
        const wP = padVal(parts[2], 3);
        const audioUrl = `https://audio.qurancdn.com/wbw/${sP}_${aP}_${wP}.mp3`;
        const audio = new Audio(audioUrl);
        audio.play().catch((e) => console.log("Word audio failed", e));
      }
    } else if (word.audio_url) {
      const audio = new Audio(`https://audio.qurancdn.com/${word.audio_url}`);
      audio.play().catch((e) => console.log("Word audio failed", e));
    }
    
    // Open bottom sheet
    setClickedWord(word);
    setIsBottomSheetOpen(true);
  };

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

  const handleNavigateAyah = (surahId: number, ayahId: number) => {
    setSelectedSurah(surahId);
    setSelectedAyah(ayahId);
  };

  const verseText = verseData 
    ? verseData.words.filter(w => w.char_type_name === "word").map(w => w.text_uthmani || w.text).join(" ")
    : "";

  return (
    <div className="mobile-shell">
      {/* HEADER SECTION (STIKY TOP) */}
      <header className="sticky top-0 z-40 w-full glass-card border-b py-3.5 px-4 flex flex-col gap-2.5 shadow-xs">
        {/* Title and navigation indicators */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={28} className="drop-shadow-xs" />
            <div>
              <h1 className="text-sm font-extrabold tracking-tight bg-linear-to-r from-brand-emerald to-brand-indigo bg-clip-text text-transparent">
                Al-Bayan Mobile
              </h1>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 leading-none">
                Quranic Morphology & AI Tafseer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Translation Select Dropdown */}
            <div className="relative flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-full text-slate-500 dark:text-slate-300">
              <Languages size={11} />
              <select
                value={selectedTranslation}
                onChange={(e) => setSelectedTranslation(Number(e.target.value))}
                className="appearance-none bg-transparent text-[10px] font-bold pr-3 border-none focus:outline-hidden focus:ring-0 cursor-pointer outline-hidden"
                title="Translation Source"
              >
                <option value={20} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Saheeh Int.</option>
                <option value={85} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Haleem</option>
                <option value={149} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Bridges</option>
              </select>
              <div className="absolute inset-y-0 right-1.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>

            {/* Reciter Select Dropdown */}
            <div className="relative flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-full text-slate-500 dark:text-slate-300">
              <Volume2 size={11} />
              <select
                value={selectedReciter}
                onChange={(e) => setSelectedReciter(e.target.value)}
                className="appearance-none bg-transparent text-[10px] font-bold pr-3 border-none focus:outline-hidden focus:ring-0 cursor-pointer outline-hidden"
                title="Select Reciter"
              >
                {RECITERS.map((r) => (
                  <option key={r.id} value={r.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                    {r.name.replace("Mahmoud Al-Husary ", "Husary ")}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-1.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>
            
            {/* Surah index info badge */}
            <div className="bg-brand-emerald/10 dark:bg-brand-emerald/20 text-brand-emerald font-semibold text-[10px] px-2.5 py-1 rounded-full">
              {selectedSurah}:{selectedAyah}
            </div>
          </div>
        </div>

        {/* Dropdown selectors and back/next buttons */}
        <div className="flex items-center gap-1.5 justify-between">
          <button
            onClick={handlePrevAyah}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-350 transition-all active:scale-90"
            title="Previous Ayah"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Surah dropdown selector */}
          <select
            value={selectedSurah}
            onChange={(e) => {
              setSelectedSurah(parseInt(e.target.value, 10));
              setSelectedAyah(1);
            }}
            className="flex-1 h-8 px-2 pr-7 rounded-lg border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-bold text-xs focus:outline-hidden focus:ring-1 focus:ring-brand-emerald/50 cursor-pointer"
          >
            {CHAPTERS.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.id}. {ch.name_simple} ({ch.name_arabic})
              </option>
            ))}
          </select>

          {/* Ayah dropdown selector */}
          <select
            value={selectedAyah}
            onChange={(e) => setSelectedAyah(parseInt(e.target.value, 10))}
            className="w-20 h-8 px-1.5 rounded-lg border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-bold text-xs focus:outline-hidden focus:ring-1 focus:ring-brand-emerald/50 cursor-pointer"
          >
            {Array.from({ length: ayahCount }, (_, i) => i + 1).map((aNum) => (
              <option key={aNum} value={aNum}>
                Ayah {aNum}
              </option>
            ))}
          </select>

          <button
            onClick={handleNextAyah}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-350 transition-all active:scale-90"
            title="Next Ayah"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Audio control tray */}
        <div className="flex items-center gap-1.5 border-t border-slate-100 dark:border-slate-800/60 pt-2.5 flex-wrap">
          {/* Play/Pause Button */}
          <button
            onClick={handlePlayRecitation}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all cursor-pointer active:scale-95 ${
              isPlayingFullAudio
                ? "bg-brand-emerald text-white animate-pulse"
                : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/80"
            }`}
            title={isPlayingFullAudio ? "Pause" : "Play recitation"}
          >
            {isPlayingFullAudio ? (
              <>
                <Pause size={10} />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play size={10} />
                <span>Play</span>
              </>
            )}
          </button>

          {/* Stop Button */}
          <button
            onClick={handleStopRecitation}
            disabled={!isPlayingFullAudio && !audioRef.current}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all cursor-pointer active:scale-95 ${
              isPlayingFullAudio || audioRef.current
                ? "bg-rose-100 dark:bg-rose-950/45 text-rose-600 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/60"
                : "bg-slate-100/50 dark:bg-slate-800/30 text-slate-350 dark:text-slate-600 cursor-not-allowed"
            }`}
            title="Stop recitation"
          >
            <Square size={10} fill={(isPlayingFullAudio || audioRef.current) ? "currentColor" : "none"} />
            <span>Stop</span>
          </button>


          {/* Audio Download Manager Button */}
          <button
            onClick={() => {
              if (isDownloadingAudio) return;
              if (isAudioOffline) {
                deleteSurahAudio(selectedSurah);
              } else {
                downloadSurahAudio(selectedSurah);
              }
            }}
            disabled={isDownloadingAudio}
            className={`flex-1 min-w-36 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all cursor-pointer active:scale-95 border ${
              isDownloadingAudio
                ? "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 cursor-wait animate-pulse"
                : isAudioOffline
                ? "bg-brand-emerald/10 dark:bg-brand-emerald/20 text-brand-emerald border-brand-emerald/30 dark:border-brand-emerald/50 hover:bg-brand-emerald/20"
                : "bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700/80"
            }`}
            title={isAudioOffline ? "Delete cached audio for this Surah" : "Download audio for this Surah for offline play"}
          >
            <Volume2 size={10} className={isDownloadingAudio ? "animate-bounce" : ""} />
            <span>
              {isDownloadingAudio 
                ? `Downloading ${downloadProgress}%` 
                : isAudioOffline 
                ? "Offline Ready (Delete)" 
                : "Download Surah Audio"}
            </span>
          </button>
        </div>
      </header>

      {/* CORE VIEW SCROLL-CONTAINER */}
      <main 
        className="flex-1 overflow-y-auto px-4 py-4 pb-6"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {activeTab === "quran" && (
          <AyahReader
            verseData={verseData}
            loading={verseLoading}
            error={verseError}
            clickedWord={clickedWord}
            onWordClick={handleWordClick}
            translationId={selectedTranslation}
          />
        )}
        
        {activeTab === "tafseer" && (
          <TafseerTab
            surahId={selectedSurah}
            ayahId={selectedAyah}
            verseText={verseText}
            tafsirs={verseData?.tafsirs || []}
          />
        )}
        
        {activeTab === "irab" && (
          <IrabTab
            surahId={selectedSurah}
            ayahId={selectedAyah}
            verseText={verseText}
            irab={verseData?.irab}
          />
        )}
      </main>

      {/* DETAILED BOTTOM SHEET MODAL */}
      <BottomSheet
        word={clickedWord}
        isOpen={isBottomSheetOpen}
        onClose={() => {
          setIsBottomSheetOpen(false);
          setClickedWord(null);
        }}
        onNavigateAyah={handleNavigateAyah}
        selectedTranslation={selectedTranslation}
      />

      {/* BOTTOM TAB NAVIGATION BAR */}
      <nav className="w-full z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex justify-around py-2 px-1">
        <button
          onClick={() => setActiveTab("quran")}
          className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === "quran"
              ? "text-brand-emerald bg-brand-emerald/5"
              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          }`}
        >
          <Logo size={18} active={activeTab === "quran"} />
          <span className="text-[10px] font-bold">Quran</span>
        </button>

        <button
          onClick={() => setActiveTab("tafseer")}
          className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === "tafseer"
              ? "text-brand-emerald bg-brand-emerald/5"
              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          }`}
        >
          <Sparkles size={18} />
          <span className="text-[10px] font-bold">Tafseer</span>
        </button>

        <button
          onClick={() => setActiveTab("irab")}
          className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === "irab"
              ? "text-brand-emerald bg-brand-emerald/5"
              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          }`}
        >
          <Layers size={18} />
          <span className="text-[10px] font-bold">I'rab (Grammar)</span>
        </button>
      </nav>
    </div>
  );
}
