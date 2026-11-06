import { useState } from "react";
import type { History as HistoryData, HistoryEvent } from "@/data/api";
import { propertyLabel } from "@/data/api";
import { useI18n } from "@/i18n";
import { Badge, Card, Empty, EntityLink, StatusBadge } from "./ui";

type Kind = HistoryEvent["kind"] | "all";

/**
 * The timeline on property and customer cards: ownership periods, leases and issues with their cost,
 * grouped by year, newest first. `showProperty` labels each entry with its property (a customer's
 * history, or a building's history that includes its units).
 */
export function History({ history, showProperty }: { history: HistoryData; showProperty: boolean }) {
  const { t, fmt } = useI18n();
  const [kind, setKind] = useState<Kind>("all");
  const events = history.events.filter((e) => kind === "all" || e.kind === kind);
  const years = [...new Set(events.map((e) => e.date.slice(0, 4)))];
  const s = history.summary;

  const propertyOf = (e: HistoryEvent) => (e.kind === "ownership" ? e.property : e.kind === "lease" ? e.lease.property : e.issue.property);
  const period = (from: string, to?: string) => `${fmt.date(from)} – ${to ? fmt.date(to) : t.history.current}`;

  return (
    <>
      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(
          [
            [t.history.summary.leases, s.leases],
            [t.history.summary.tenants, s.tenants],
            [t.history.summary.issues, s.issues],
            [t.history.summary.repairCost, fmt.money(s.repairCostMinor)],
            [t.history.summary.professionals, s.professionals],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
            <dt className="text-xs font-semibold text-muted">{label}</dt>
            <dd className="mt-1 text-lg font-bold text-brand-900">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={t.history.filter}>
        {(["all", "ownership", "lease", "issue"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${
              kind === k ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-brand-700 ring-brand-200 hover:bg-brand-50"
            }`}
          >
            {t.history.kinds[k]}
          </button>
        ))}
      </div>

      {!events.length ? (
        <Empty>{t.history.empty}</Empty>
      ) : (
        years.map((year) => (
          <Card key={year} title={year} className="mb-4">
            <ol className="space-y-4 border-s-2 border-brand-100 ps-4">
              {events
                .filter((e) => e.date.startsWith(year))
                .map((e) => {
                  const p = propertyOf(e);
                  return (
                    <li key={`${e.kind}-${e.kind === "issue" ? e.issue.id : e.kind === "lease" ? e.lease.id : `${e.property.id}-${e.customer.id}-${e.date}`}`}>
                      <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        <Badge color={e.kind === "issue" ? "amber" : e.kind === "lease" ? "brand" : "blue"}>{t.history[e.kind]}</Badge>
                        <span>{e.kind === "issue" ? fmt.date(e.issue.openedAt) : period(e.date, e.endDate)}</span>
                        {showProperty && (
                          <EntityLink to={`/properties/${p.id}`}>{`${propertyLabel(p)}, ${p.city}`}</EntityLink>
                        )}
                      </p>
                      {e.kind === "ownership" && (
                        <p className="text-sm">
                          <EntityLink to={`/customers/${e.customer.id}`}>{e.customer.name}</EntityLink>
                          <span className="ms-2 text-muted">{t.history.share(e.sharePercent)}</span>
                        </p>
                      )}
                      {e.kind === "lease" && (
                        <p className="text-sm">
                          <EntityLink to={`/tenants/${e.lease.tenant.id}`}>{e.lease.tenant.name}</EntityLink>
                          <span className="ms-2 text-muted">{fmt.money(e.lease.monthlyRentMinor)}</span>
                        </p>
                      )}
                      {e.kind === "issue" && (
                        <div className="text-sm">
                          <p className="flex flex-wrap items-center gap-2">
                            <EntityLink to={`/issues/${e.issue.id}`}>{`#${e.issue.number} ${e.issue.title}`}</EntityLink>
                            <StatusBadge status={e.issue.status} />
                          </p>
                          <p className="text-muted">
                            {t.categories[e.issue.category]}
                            {e.issue.professional && (
                              <>
                                {" · "}
                                <EntityLink to={`/professionals/${e.issue.professional.id}`}>{e.issue.professional.name}</EntityLink>
                              </>
                            )}
                            {e.issue.actualCostMinor !== undefined && ` · ${t.history.cost}: ${fmt.money(e.issue.actualCostMinor)}`}
                          </p>
                          {e.issue.resolution && <p className="text-muted">{e.issue.resolution}</p>}
                        </div>
                      )}
                    </li>
                  );
                })}
            </ol>
          </Card>
        ))
      )}
    </>
  );
}
