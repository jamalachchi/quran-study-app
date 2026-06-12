import { CHAPTERS } from "./chapters";
import type { OccurrenceGroup } from "./types";

export const RECITERS = [
  { id: "Husary_64kbps", name: "Mahmoud Al-Husary (Murattal)", details: "Mahmoud Khalil Al-Husary (Murattal)" },
  { id: "Husary_128kbps_Mujawwad", name: "Mahmoud Al-Husary (Mujawwad)", details: "Mahmoud Khalil Al-Husary (Mujawwad)" },
  { id: "Husary_Muallim_128kbps", name: "Mahmoud Al-Husary (Muallim)", details: "Mahmoud Khalil Al-Husary (Muallim)" }
];

export const PART_OF_SPEECH_MAP: Record<string, string> = {
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

export const FEATURE_EXPLANATIONS: Record<string, { label: string; desc: string }> = {
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

export function parseFeatureString(featuresStr: string, tag: string) {
  const parts = featuresStr.split('|');
  const explanations: Array<{ label: string; value: string }> = [];

  const friendlyTag = PART_OF_SPEECH_MAP[tag] || tag;
  explanations.push({ label: "Part of Speech", value: friendlyTag });

  for (const part of parts) {
    if (part === "STEM" || part === "PREFIX" || part === "SUFFIX") {
      explanations.push({ 
        label: "Segment Type", 
        value: part === "STEM" ? "Stem (أصل الكلمة)" : part === "PREFIX" ? "Prefix (سابقة)" : "Suffix (لاحقة)" 
      });
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

export const groupOccurrences = (locations: string[]): OccurrenceGroup[] => {
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

export const getTranslationText = (verseData: any, resourceId: number) => {
  const translation = verseData?.translations.find((t: any) => t.resource_id === resourceId);
  if (!translation) return "Translation not available.";
  return translation.text.replace(/<sup[^>]*>.*?<\/sup>/g, "").replace(/<[^>]*>/g, "");
};
