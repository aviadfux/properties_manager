import type { Metadata } from "next";
import { en } from "@/content/en";
import { he } from "@/content/he";
import { localePath, site, type Locale } from "@/site.config";

export const dictionaries = { he, en };

// Page metadata with links to the same page in the other language.
export function pageMetadata(locale: Locale, path = "", title?: string): Metadata {
  const t = dictionaries[locale];
  return {
    metadataBase: new URL(site.url),
    title: title ? `${title} | ${site.name[locale]}` : t.meta.title,
    description: t.meta.description,
    alternates: {
      canonical: localePath(locale, path),
      languages: { he: localePath("he", path), en: localePath("en", path) },
    },
    openGraph: {
      title: t.meta.title,
      description: t.meta.description,
      siteName: site.name[locale],
      locale: locale === "he" ? "he_IL" : "en_US",
      type: "website",
    },
  };
}
