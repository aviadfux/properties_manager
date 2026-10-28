import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { en } from "./en";
import { he, type Dictionary } from "./he";

export type Locale = "he" | "en";
const dictionaries: Record<Locale, Dictionary> = { he, en };
const STORAGE_KEY = "admin.locale";

function initialLocale(): Locale {
  // A ?lang=en / ?lang=he link picks the language (handy for sharing and testing).
  const fromUrl = new URLSearchParams(window.location.search).get("lang");
  if (fromUrl === "he" || fromUrl === "en") return fromUrl;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "he" || saved === "en") return saved;
  } catch {
    // storage unavailable (private mode): fall back to Hebrew
  }
  return "he";
}

type Ctx = { locale: Locale; t: Dictionary; setLocale: (l: Locale) => void; fmt: ReturnType<typeof formatters> };
const I18nContext = createContext<Ctx | null>(null);

function formatters(locale: Locale) {
  const tag = locale === "he" ? "he-IL" : "en-IL";
  const money = new Intl.NumberFormat(tag, { style: "currency", currency: "ILS", maximumFractionDigits: 0 });
  const dateF = new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jerusalem" });
  const dateTimeF = new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });
  return {
    money: (minor: number) => money.format(minor / 100),
    date: (iso: string) => dateF.format(new Date(iso)),
    dateTime: (iso: string) => dateTimeF.format(new Date(iso)),
    daysSince: (iso: string) => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)),
    // Phone numbers are stored in E.164; shown in local format.
    phone: (e164: string) => {
      const local = e164.startsWith("+972") ? "0" + e164.slice(4) : e164;
      if (local.length === 10) return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`; // mobile: 052-123-4567
      if (local.length === 9) return `${local.slice(0, 2)}-${local.slice(2, 5)}-${local.slice(5)}`; // landline: 03-612-3456
      return local;
    },
  };
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "he" ? "rtl" : "ltr";
    document.title = dictionaries[locale].appName;
  }, [locale]);

  const value = useMemo<Ctx>(
    () => ({
      locale,
      t: dictionaries[locale],
      fmt: formatters(locale),
      setLocale: (l) => {
        setLocaleState(l);
        try {
          localStorage.setItem(STORAGE_KEY, l);
        } catch {
          // ignore: the choice just won't be remembered
        }
      },
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
