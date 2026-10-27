import type { Dictionary } from "@/content/types";
import { localePath, type Locale } from "@/site.config";
import { Footer } from "./Footer";
import { Header } from "./Header";

type Doc = Dictionary["legal"]["accessibility"];

// Accessibility statement and privacy policy share this layout.
export function LegalPage({ locale, t, doc }: { locale: Locale; t: Dictionary; doc: Doc }) {
  return (
    <>
      <Header locale={locale} t={t} onHome={false} />
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 sm:px-6">
        <h1 className="text-3xl font-bold text-brand-900">{doc.title}</h1>
        {doc.sections.map((s) => (
          <section key={s.heading} className="mt-8">
            <h2 className="text-xl font-bold text-brand-900">{s.heading}</h2>
            {s.body.length > 1 ? (
              <ul className="mt-3 list-disc space-y-2 ps-6 text-muted">
                {s.body.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-muted">{s.body[0]}</p>
            )}
          </section>
        ))}
        <p className="mt-12">
          <a href={localePath(locale)} className="font-semibold text-brand-700 hover:underline">
            {t.legal.backHome}
          </a>
        </p>
      </main>
      <Footer locale={locale} t={t} />
    </>
  );
}
