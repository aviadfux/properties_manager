import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { useNavigate } from "react-router";
import { search, type SearchResult } from "@/data/api";
import { useI18n } from "@/i18n";
import { Icon } from "./icons";

const PATHS: Record<SearchResult["kind"], string> = {
  customer: "/customers",
  property: "/properties",
  tenant: "/tenants",
  issue: "/issues",
};

/** Global search (spec §3): customers, properties, tenants and issues; keyboard-operable combobox. */
export function SearchBox() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const listId = useId();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term), 200);
    return () => clearTimeout(id);
  }, [term]);

  const results = useQuery({ queryKey: ["search", debounced], queryFn: () => search(debounced), enabled: debounced.trim().length > 0 });
  const items = results.data ?? [];
  const kindLabel: Record<SearchResult["kind"], string> = {
    customer: t.nav.customers,
    property: t.nav.properties,
    tenant: t.nav.tenants,
    issue: t.nav.issues,
  };

  function go(r: SearchResult) {
    navigate(`${PATHS[r.kind]}/${r.id}`);
    setTerm("");
    setOpen(false);
  }

  return (
    <div className="relative max-w-xl flex-1">
      <label htmlFor="global-search" className="sr-only">
        {t.search.label}
      </label>
      <Icon name="search" className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        id="global-search"
        type="search"
        role="combobox"
        aria-expanded={open && term.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && items[active] ? `${listId}-${active}` : undefined}
        placeholder={t.search.placeholder}
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, items.length - 1));
          else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
          else if (e.key === "Enter" && items[active]) go(items[active]);
          else if (e.key === "Escape") setOpen(false);
          else return;
          e.preventDefault();
        }}
        className="w-full rounded-full border border-slate-300 bg-slate-50 py-2 pe-4 ps-9 text-sm focus:border-brand-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
      />
      {open && term.trim() && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-40 mt-2 max-h-96 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {results.isSuccess && items.length === 0 && <li className="px-4 py-3 text-sm text-muted">{t.search.none}</li>}
          {items.map((r, i) => (
            <li
              key={`${r.kind}-${r.id}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                go(r);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm ${i === active ? "bg-brand-50" : ""}`}
            >
              <span>
                <span className="font-semibold text-ink">{r.label}</span>
                <span className="ms-2 text-muted">{r.sub}</span>
              </span>
              <span className="text-xs text-muted">{kindLabel[r.kind]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
