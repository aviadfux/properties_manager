import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router";
import { Icon } from "@/components/icons";
import { IssueTable } from "@/components/IssueTable";
import { Badge, Card, EntityLink, Fields, Loaded, Ltr, PageHeader, Table, Td } from "@/components/ui";
import { getProfessional, listCities, listProfessionals, type ProfessionalFilter, type ProfessionalRow } from "@/data/api";
import type { IssueCategory, Professional } from "@/domain/types";
import { useI18n } from "@/i18n";

export const select =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200";

export function Rating({ value }: { value?: Professional["rating"] }) {
  const { t } = useI18n();
  if (!value) return <span className="text-muted">—</span>;
  return (
    <span className="whitespace-nowrap text-accent-400" role="img" aria-label={`${t.professionals.rating}: ${value}/5`}>
      {"★".repeat(value)}
      <span className="text-slate-300">{"★".repeat(5 - value)}</span>
    </span>
  );
}

export function Trades({ trades }: { trades: IssueCategory[] }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap gap-1">
      {trades.map((c) => (
        <Badge key={c} color="brand">
          {t.categories[c]}
        </Badge>
      ))}
    </div>
  );
}

/** Regions and extra cities a professional serves. */
export function Areas({ p }: { p: ProfessionalRow }) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-sm">
      {p.areas.map((a) => (
        <span key={a.id} title={a.cities.join(", ")}>
          <Badge color="blue">{a.name}</Badge>
        </span>
      ))}
      {p.extraCities.length > 0 && <span>{p.extraCities.join(", ")}</span>}
    </div>
  );
}

/** Where the professional's open jobs are right now. */
export function WorkingNow({ p }: { p: ProfessionalRow }) {
  const { t } = useI18n();
  if (!p.workingNow.length) return <span className="text-xs text-muted">{t.professionals.notWorkingNow}</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted">
      <Icon name="pin" className="h-3.5 w-3.5 shrink-0" />
      {t.professionals.workingNow}
      {p.workingNow.map((w) => (w.jobs > 1 ? `${w.city} (${w.jobs})` : w.city)).join(", ")}
    </span>
  );
}

export function Professionals() {
  const { t, fmt } = useI18n();
  // Filters live in the URL, like the issues list.
  const [params, setParams] = useSearchParams();
  const filter: ProfessionalFilter = {
    trade: (params.get("trade") as IssueCategory) || undefined,
    city: params.get("city") || undefined,
    q: params.get("q") ?? undefined,
  };
  const query = useQuery({ queryKey: ["professionals", filter], queryFn: () => listProfessionals(filter) });
  const cities = useQuery({ queryKey: ["cities"], queryFn: listCities });

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  return (
    <>
      <PageHeader title={t.professionals.title} intro={t.professionals.intro} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="f-trade" className="block text-xs font-semibold text-muted">
            {t.professionals.filters.trade}
          </label>
          <select id="f-trade" className={select} value={filter.trade ?? ""} onChange={(e) => update("trade", e.target.value)}>
            <option value="">{t.common.all}</option>
            {(Object.keys(t.categories) as IssueCategory[]).map((c) => (
              <option key={c} value={c}>
                {t.categories[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-city" className="block text-xs font-semibold text-muted">
            {t.professionals.filters.city}
          </label>
          <select id="f-city" className={select} value={filter.city ?? ""} onChange={(e) => update("city", e.target.value)}>
            <option value="">{t.common.all}</option>
            {cities.data?.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-48 flex-1">
          <label htmlFor="f-q" className="block text-xs font-semibold text-muted">
            {t.professionals.filters.search}
          </label>
          <input id="f-q" type="search" className={`${select} w-full`} value={filter.q ?? ""} onChange={(e) => update("q", e.target.value)} />
        </div>
      </div>
      <Loaded query={query}>
        {(rows) => (
          <>
            <p className="mb-2 text-sm text-muted" role="status">
              {t.professionals.count(rows.length)}
            </p>
            <Table
              head={[t.common.number, t.common.name, t.professionals.trades, t.professionals.areas, t.common.phone, t.professionals.openJobs, t.professionals.rating]}
            >
              {rows.map((p) => (
                <tr key={p.id} className={p.active ? "" : "opacity-60"}>
                  <Td className="text-muted">{p.number}</Td>
                  <Td>
                    <EntityLink to={`/professionals/${p.id}`}>{p.name}</EntityLink>
                    <div className="text-xs text-muted">
                      {p.contactName ?? t.kinds[p.kind]}
                      {!p.active && (
                        <span className="ms-2">
                          <Badge>{t.professionals.inactive}</Badge>
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <Trades trades={p.trades} />
                  </Td>
                  <Td className="max-w-72">
                    <Areas p={p} />
                    <div className="mt-1">
                      <WorkingNow p={p} />
                    </div>
                  </Td>
                  <Td>
                    <Ltr>{fmt.phone(p.phone)}</Ltr>
                  </Td>
                  <Td className="font-semibold">{p.openJobs}</Td>
                  <Td>
                    <Rating value={p.rating} />
                  </Td>
                </tr>
              ))}
            </Table>
          </>
        )}
      </Loaded>
    </>
  );
}

export function ProfessionalDetail() {
  const { id = "" } = useParams();
  const { t, fmt } = useI18n();
  const query = useQuery({ queryKey: ["professional", id], queryFn: () => getProfessional(id) });

  return (
    <Loaded query={query}>
      {({ professional: p, issues, totalCostMinor }) => (
        <>
          <PageHeader
            title={p.name}
            intro={`${t.kinds[p.kind]} · #${p.number}`}
            actions={
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge color={p.active ? "green" : "gray"}>{p.active ? t.professionals.active : t.professionals.inactive}</Badge>
                <a href={`tel:${p.phone}`} className="rounded-full border border-brand-200 px-4 py-1.5 font-semibold text-brand-700 hover:bg-brand-50">
                  <Ltr>{fmt.phone(p.phone)}</Ltr>
                </a>
                {p.email && (
                  <a href={`mailto:${p.email}`} className="rounded-full border border-brand-200 px-4 py-1.5 font-semibold text-brand-700 hover:bg-brand-50">
                    {p.email}
                  </a>
                )}
              </div>
            }
          />
          {!p.active && <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900">{t.professionals.inactiveNote}</p>}
          <div className="mb-8 grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <Fields
                items={[
                  [t.professionals.trades, <Trades trades={p.trades} />],
                  [t.professionals.areas, <Areas p={p} />],
                  [t.professionals.coverage, p.coverage.join(", ")],
                  [t.professionals.currentWork, <WorkingNow p={p} />],
                  [t.professionals.contact, p.contactName],
                  [t.professionals.taxId, p.taxId],
                  [t.professionals.rating, <Rating value={p.rating} />],
                  [t.common.notes, p.notes],
                ]}
              />
            </Card>
            <Card>
              <Fields
                items={[
                  [t.professionals.openJobs, p.openJobs],
                  [t.professionals.totalJobs, p.totalJobs],
                  [t.professionals.totalCost, fmt.money(totalCostMinor)],
                ]}
              />
            </Card>
          </div>
          <h2 className="mb-3 font-bold text-brand-900">{t.professionals.jobs}</h2>
          <IssueTable issues={issues} hide={["reporter", "assignee"]} />
        </>
      )}
    </Loaded>
  );
}
