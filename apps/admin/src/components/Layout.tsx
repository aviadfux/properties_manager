import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { listTodo } from "@/data/api";
import { useI18n } from "@/i18n";
import { Icon, type IconName } from "./icons";
import { SearchBox } from "./SearchBox";

const NAV: { to: string; key: keyof ReturnType<typeof useI18n>["t"]["nav"]; icon: IconName }[] = [
  { to: "/", key: "dashboard", icon: "home" },
  { to: "/todo", key: "todo", icon: "bell" },
  { to: "/customers", key: "customers", icon: "users" },
  { to: "/properties", key: "properties", icon: "building" },
  { to: "/tenants", key: "tenants", icon: "key" },
  { to: "/issues", key: "issues", icon: "wrench" },
];

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n();
  const todo = useQuery({ queryKey: ["todo"], queryFn: listTodo });
  return (
    <ul className="space-y-1">
      {NAV.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end={item.to === "/"}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold ${
                isActive ? "bg-brand-700 text-white" : "text-brand-100 hover:bg-brand-800 hover:text-white"
              }`
            }
          >
            <Icon name={item.icon} className="h-5 w-5" />
            <span className="flex-1">{t.nav[item.key]}</span>
            {item.key === "todo" && !!todo.data?.length && (
              <span className="rounded-full bg-accent-400 px-2 py-0.5 text-xs font-bold text-brand-900">{todo.data.length}</span>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

function Brand() {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2 px-3 py-4 text-white">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#0f766e" />
        <path d="M8 15.5 16 9l8 6.5V24H8z" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="16" cy="17" r="1.6" fill="#f0ad3c" />
        <path d="M16 18.6V22" stroke="#f0ad3c" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span className="font-bold leading-tight">{t.appName}</span>
    </div>
  );
}

export function Layout() {
  const { t, locale, setLocale } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Move focus to the page heading after navigation (not on first load), for keyboard and screen-reader users.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document.querySelector<HTMLElement>("main h1")?.focus();
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-brand-800 focus:px-4 focus:py-2 focus:text-white"
      >
        {t.skipToContent}
      </a>

      {/* Sidebar: on the right in Hebrew, on the left in English (follows the document direction). */}
      <aside className="hidden w-64 shrink-0 bg-brand-900 px-3 lg:block">
        <div className="sticky top-0">
          <Brand />
          <nav aria-label={t.nav.menu}>
            <Nav />
          </nav>
        </div>
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={t.nav.menu}>
          <button type="button" className="absolute inset-0 bg-black/40" aria-label={t.nav.close} onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 start-0 w-72 bg-brand-900 px-3">
            <Brand />
            <nav aria-label={t.nav.menu}>
              <Nav onNavigate={() => setMenuOpen(false)} />
            </nav>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            className="rounded-md p-2 text-brand-800 hover:bg-brand-50 lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-expanded={menuOpen}
          >
            <Icon name="menu" className="h-6 w-6" />
            <span className="sr-only">{t.nav.menu}</span>
          </button>
          <SearchBox />
          <span className="hidden rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200 sm:inline">
            {t.sampleData}
          </span>
          <button
            type="button"
            lang={locale === "he" ? "en" : "he"}
            onClick={() => setLocale(locale === "he" ? "en" : "he")}
            className="rounded-md px-2 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            {t.language}
          </button>
        </header>

        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
