import type { Dictionary } from "@/content/types";
import { localePath, site, type Locale } from "@/site.config";
import { LogoMark } from "./icons";

export function Footer({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <footer className="bg-brand-900 text-brand-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2">
          <LogoMark className="h-7 w-7 text-brand-600" />
          <span className="font-bold text-white">{site.name[locale]}</span>
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <li>
            <a href={`tel:${site.phone.tel}`} className="hover:text-white">
              <span dir="ltr">{site.phone.display}</span>
            </a>
          </li>
          <li>
            <a href={localePath(locale, "accessibility/")} className="hover:text-white">
              {t.footer.accessibility}
            </a>
          </li>
          <li>
            <a href={localePath(locale, "privacy/")} className="hover:text-white">
              {t.footer.privacy}
            </a>
          </li>
        </ul>
        <p className="text-sm">
          © {new Date().getFullYear()} {site.name[locale]}. {t.footer.rights}.
        </p>
      </div>
    </footer>
  );
}
