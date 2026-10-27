import type { Dictionary } from "@/content/types";
import { site, whatsappLink, type Locale } from "@/site.config";
import { ContactForm } from "./ContactForm";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { CheckIcon, PhoneIcon, ServiceIcon, WhatsAppIcon } from "./icons";

function Section({ id, title, children, tinted = false }: { id: string; title: string; children: React.ReactNode; tinted?: boolean }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={tinted ? "bg-brand-50" : ""}>
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <h2 id={`${id}-title`} className="text-2xl font-bold text-brand-900 sm:text-3xl">
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

export function Landing({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <>
      <Header locale={locale} t={t} />
      <main id="main">
        {/* Hero */}
        <section aria-labelledby="hero-title" className="relative overflow-hidden bg-brand-900 text-white">
          <div
            aria-hidden="true"
            className="absolute -end-32 -top-32 h-96 w-96 rounded-full bg-brand-700/60 blur-3xl"
          />
          <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
            <p className="font-semibold text-accent-300">{t.hero.eyebrow}</p>
            <h1 id="hero-title" className="mt-3 max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl">
              {t.hero.title}
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-brand-100">{t.hero.subtitle}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={whatsappLink(t.contact.form.whatsappIntro)}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-accent-400 px-6 py-3 font-semibold text-brand-900 hover:bg-accent-300"
              >
                <WhatsAppIcon className="h-5 w-5" />
                {t.hero.whatsapp}
              </a>
              <a
                href={`tel:${site.phone.tel}`}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-brand-200 px-6 py-3 font-semibold text-white hover:bg-brand-800"
              >
                <PhoneIcon className="h-5 w-5" />
                <span>{t.hero.call.split(site.phone.display)[0]}</span>
                <span dir="ltr">{site.phone.display}</span>
              </a>
            </div>
          </div>
        </section>

        <Section id="services" title={t.services.title}>
          <p className="mt-3 max-w-2xl text-muted">{t.services.intro}</p>
          <ul className="mt-10 grid gap-6 md:grid-cols-3">
            {t.services.items.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-brand-100 p-6 shadow-sm">
                <ServiceIcon index={i} className="h-10 w-10 text-brand-700" />
                <h3 className="mt-4 text-lg font-bold text-brand-900">{s.title}</h3>
                <p className="mt-2 text-muted">{s.text}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="how-it-works" title={t.howItWorks.title} tinted>
          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {t.howItWorks.steps.map((s, i) => (
              <li key={s.title} className="rounded-2xl bg-white p-6 shadow-sm">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-700 font-bold text-white"
                >
                  {i + 1}
                </span>
                <h3 className="mt-4 font-bold text-brand-900">{s.title}</h3>
                <p className="mt-2 text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="why" title={t.why.title}>
          <ul className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2">
            {t.why.items.map((w) => (
              <li key={w.title} className="flex gap-4">
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                  <CheckIcon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-bold text-brand-900">{w.title}</h3>
                  <p className="mt-1 text-muted">{w.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="faq" title={t.faq.title} tinted>
          <div className="mt-8 divide-y divide-brand-100 rounded-2xl bg-white shadow-sm">
            {t.faq.items.map((f) => (
              <details key={f.q} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-brand-900">
                  {f.q}
                  <span aria-hidden="true" className="text-xl text-brand-700 transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </Section>

        <Section id="contact" title={t.contact.title}>
          <div className="mt-3 grid gap-10 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <p className="text-muted">{t.contact.text}</p>
              <p className="mt-6 font-semibold text-brand-900">{t.contact.orCall}</p>
              <a href={`tel:${site.phone.tel}`} className="mt-1 inline-block text-2xl font-bold text-brand-700 hover:underline">
                <span dir="ltr">{site.phone.display}</span>
              </a>
            </div>
            <div className="lg:col-span-2">
              <ContactForm t={t.contact.form} />
            </div>
          </div>
        </Section>
      </main>
      <Footer locale={locale} t={t} />
    </>
  );
}
