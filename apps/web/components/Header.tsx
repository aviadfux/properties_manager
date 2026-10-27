"use client";

import { useState } from "react";
import type { Dictionary } from "@/content/types";
import { localePath, site, type Locale } from "@/site.config";
import { LogoMark, MenuIcon, PhoneIcon } from "./icons";

export function Header({ locale, t, onHome = true }: { locale: Locale; t: Dictionary; onHome?: boolean }) {
  const [open, setOpen] = useState(false);
  const other: Locale = locale === "he" ? "en" : "he";
  // Section links work from any page: on the home page they are plain anchors.
  const home = onHome ? "" : localePath(locale);
  const links = [
    { href: `${home}#services`, label: t.nav.services },
    { href: `${home}#how-it-works`, label: t.nav.howItWorks },
    { href: `${home}#faq`, label: t.nav.faq },
    { href: `${home}#contact`, label: t.nav.contact },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-brand-100 bg-white/95 backdrop-blur">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-brand-800 focus:px-4 focus:py-2 focus:text-white"
      >
        {t.skipToContent}
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href={localePath(locale)} className="flex items-center gap-2 text-brand-800">
          <LogoMark className="h-8 w-8 text-brand-700" />
          <span className="text-lg font-bold">{site.name[locale]}</span>
        </a>

        <nav aria-label={t.nav.menu} className="hidden md:block">
          <ul className="flex items-center gap-6 text-sm font-medium text-muted">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="hover:text-brand-700">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={localePath(other)}
            lang={other}
            hrefLang={other}
            className="rounded-md px-2 py-1 text-sm font-medium text-brand-700 hover:bg-brand-50"
          >
            {t.nav.otherLanguage}
          </a>
          <a
            href={`tel:${site.phone.tel}`}
            className="hidden items-center gap-2 rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 sm:flex"
          >
            <PhoneIcon className="h-4 w-4" />
            <span dir="ltr">{site.phone.display}</span>
          </a>
          <button
            type="button"
            className="rounded-md p-2 text-brand-800 hover:bg-brand-50 md:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen(!open)}
          >
            <MenuIcon className="h-6 w-6" />
            <span className="sr-only">{t.nav.menu}</span>
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-menu" aria-label={t.nav.menu} className="border-t border-brand-100 md:hidden">
          <ul className="mx-auto max-w-6xl px-4 py-2">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)} className="block py-3 font-medium text-ink">
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <a href={`tel:${site.phone.tel}`} className="block py-3 font-semibold text-brand-700">
                <span dir="ltr">{site.phone.display}</span>
              </a>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
