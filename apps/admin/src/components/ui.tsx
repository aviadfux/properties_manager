// Small building blocks shared by all admin screens.
import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link } from "react-router";
import type { IssueStatus, Urgency } from "@/domain/types";
import { useI18n } from "@/i18n";

export function PageHeader({ title, intro, actions }: { title: string; intro?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 tabIndex={-1} className="text-2xl font-bold text-brand-900 focus:outline-none">{title}</h1>
        {intro && <p className="mt-1 text-muted">{intro}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Card({ title, action, children, className = "" }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-4">
          {title && <h2 className="font-bold text-brand-900">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Renders loading / error states for a query, then the content. */
export function Loaded<T>({ query, children }: { query: UseQueryResult<T>; children: (data: T) => ReactNode }) {
  const { t } = useI18n();
  if (query.isPending) return <p className="py-10 text-center text-muted" role="status">{t.common.loading}</p>;
  if (query.isError) return <p className="py-10 text-center font-medium text-red-700" role="alert">{t.common.error}</p>;
  return <>{children(query.data)}</>;
}

const tone = {
  red: "bg-red-50 text-red-800 ring-red-200",
  amber: "bg-amber-50 text-amber-900 ring-amber-200",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  brand: "bg-brand-50 text-brand-800 ring-brand-200",
};
export type Tone = keyof typeof tone;

export function Badge({ children, color = "gray" }: { children: ReactNode; color?: Tone }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${tone[color]}`}>
      {children}
    </span>
  );
}

const urgencyTone: Record<Urgency, Tone> = { emergency: "red", high: "amber", normal: "gray", low: "gray" };
export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const { t } = useI18n();
  return <Badge color={urgencyTone[urgency]}>{t.urgency[urgency]}</Badge>;
}

const statusTone: Record<IssueStatus, Tone> = {
  new: "blue",
  under_review: "blue",
  awaiting_quote: "amber",
  awaiting_approval: "amber",
  approved: "brand",
  scheduled: "brand",
  in_progress: "brand",
  awaiting_signoff: "amber",
  closed: "green",
  cancelled: "gray",
};
export function StatusBadge({ status }: { status: IssueStatus }) {
  const { t } = useI18n();
  return <Badge color={statusTone[status]}>{t.issueStatus[status]}</Badge>;
}

/** A table that scrolls sideways on narrow screens instead of breaking the page. */
export function Table({ head, children, caption }: { head: ReactNode[]; children: ReactNode; caption?: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-start text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="whitespace-nowrap px-4 py-3 text-start font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}

export function EntityLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="font-semibold text-brand-700 hover:underline">
      {children}
    </Link>
  );
}

export function Empty({ children }: { children?: ReactNode }) {
  const { t } = useI18n();
  return <p className="py-6 text-center text-muted">{children ?? t.common.noItems}</p>;
}

/** Label / value pairs for detail cards. */
export function Fields({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-semibold text-muted">{label}</dt>
          <dd className="mt-0.5">{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Phone numbers and other left-to-right values inside right-to-left text. */
export function Ltr({ children }: { children: ReactNode }) {
  return <span dir="ltr" className="inline-block">{children}</span>;
}

export function Tabs<K extends string>({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: { key: K; label: string; count?: number }[];
  active: K;
  onChange: (k: K) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          type="button"
          id={`tab-${tab.key}`}
          aria-selected={active === tab.key}
          aria-controls={`panel-${tab.key}`}
          onClick={() => onChange(tab.key)}
          className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold ${
            active === tab.key ? "border-brand-700 text-brand-800" : "border-transparent text-muted hover:text-brand-700"
          }`}
        >
          {tab.label}
          {tab.count !== undefined && <span className="ms-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}
