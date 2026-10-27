// Every company-specific detail of the public website lives here (spec §2 "Public Website").
// To use the site for another company, replace this file and the texts in content/.

export const site = {
  name: { he: "עוגן ניהול נכסים", en: "Ogen Property Management" },
  shortName: { he: "עוגן", en: "Ogen" },
  phone: {
    display: "052-660-3804",
    tel: "+972526603804",
    whatsapp: "972526603804", // international format without "+", for wa.me links
  },
  serviceArea: { he: "מרכז הארץ", en: "Central Israel" },
  url: "https://example.com", // replace with the real domain once chosen
  accessibilityStatementDate: { he: "27 באוקטובר 2026", en: "October 27, 2026" },
} as const;

export type Locale = "he" | "en";

export function whatsappLink(text?: string) {
  const base = `https://wa.me/${site.phone.whatsapp}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

// Paths of the same page in each language.
export function localePath(locale: Locale, path = "") {
  return locale === "he" ? `/${path}` : `/en/${path}`;
}
