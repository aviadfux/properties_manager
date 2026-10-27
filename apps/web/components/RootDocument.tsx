import { Heebo } from "next/font/google";
import type { Locale } from "@/site.config";

// Heebo covers Hebrew and Latin, so both languages share one typeface.
const heebo = Heebo({ subsets: ["hebrew", "latin"], variable: "--font-heebo", display: "swap" });

export function RootDocument({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return (
    <html lang={locale} dir={locale === "he" ? "rtl" : "ltr"} className={`${heebo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
