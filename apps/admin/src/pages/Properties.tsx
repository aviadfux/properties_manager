import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router";
import { History } from "@/components/History";
import { IssueTable } from "@/components/IssueTable";
import { Badge, Card, Empty, EntityLink, Fields, Loaded, PageHeader, Table, Tabs, Td, type Tone } from "@/components/ui";
import { getProperty, listProperties, propertyLabel, type Occupancy, type PropertyRow } from "@/data/api";
import { isContainerKind } from "@/domain/types";
import { useI18n } from "@/i18n";

const occupancyTone: Record<Occupancy, Tone> = { occupied: "green", partial: "blue", vacant: "amber" };

export function OccupancyBadge({ p }: { p: PropertyRow }) {
  const { t } = useI18n();
  return (
    <>
      <Badge color={occupancyTone[p.occupancy]}>{t.occupancy[p.occupancy]}</Badge>
      {p.units && <div className="mt-1 text-xs text-muted">{t.properties.unitsLet(p.units.occupied, p.units.total)}</div>}
    </>
  );
}

/** Properties as a tree: a building's units appear indented under it. */
export function PropertyTable({ rows, hideOwner = false }: { rows: PropertyRow[]; hideOwner?: boolean }) {
  const { t } = useI18n();
  if (!rows.length) return <Empty />;
  return (
    <Table
      head={[
        t.common.number,
        t.common.address,
        t.properties.kind,
        ...(hideOwner ? [] : [t.properties.owner]),
        t.properties.tenants,
        t.properties.occupancy,
        t.properties.openIssues,
      ]}
    >
      {rows.map((p) => (
        <tr key={p.id} className={isContainerKind(p.kind) ? "bg-slate-50/60" : ""}>
          <Td className="text-muted">{p.number}</Td>
          <Td>
            {/* Indentation shows nesting; the "part of" relation is also stated on the property card. */}
            <div style={{ paddingInlineStart: `${p.depth * 1.25}rem` }} className={p.depth ? "border-s-2 border-brand-100" : ""}>
              <div className={p.depth ? "ps-2" : ""}>
                <EntityLink to={`/properties/${p.id}`}>{propertyLabel(p)}</EntityLink>
                <div className="text-xs text-muted">
                  {p.city}
                  {p.parts > 0 && ` · ${t.properties.partsCount(p.parts)}`}
                </div>
              </div>
            </div>
          </Td>
          <Td>{t.propertyKinds[p.kind]}</Td>
          {!hideOwner && (
            <Td>
              {/* Owners inherited from a larger property are shown once, on that property. */}
              {!p.ownersFrom &&
                p.owners.map((o) => (
                  <div key={o.customer.id}>
                    <EntityLink to={`/customers/${o.customer.id}`}>{o.customer.name}</EntityLink>
                    {o.sharePercent < 100 && <span className="ms-1 text-xs text-muted">({o.sharePercent}%)</span>}
                  </div>
                ))}
              {p.ownersFrom && <span className="text-xs text-muted">{`${t.properties.inheritedFrom}${propertyLabel(p.ownersFrom)}`}</span>}
            </Td>
          )}
          <Td>
            {p.tenants.map((tn) => (
              <div key={tn.id}>
                <EntityLink to={`/tenants/${tn.id}`}>{tn.name}</EntityLink>
              </div>
            ))}
          </Td>
          <Td>
            <OccupancyBadge p={p} />
          </Td>
          <Td className="font-semibold">{p.openIssues}</Td>
        </tr>
      ))}
    </Table>
  );
}

export function Properties() {
  const { t } = useI18n();
  const query = useQuery({ queryKey: ["properties"], queryFn: listProperties });
  return (
    <>
      <PageHeader title={t.properties.title} intro={t.properties.intro} />
      <Loaded query={query}>{(rows) => <PropertyTable rows={rows} />}</Loaded>
    </>
  );
}

type Tab = "issues" | "leases" | "parts" | "history";

export function PropertyDetail() {
  const { id = "" } = useParams();
  const { t, fmt } = useI18n();
  const query = useQuery({ queryKey: ["property", id], queryFn: () => getProperty(id) });
  const [tab, setTab] = useState<Tab | undefined>();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Loaded query={query}>
      {({ property: p, partOf, parts, leases, issues, history }) => {
        // A building opens on its units; a single unit opens on its issues.
        const active: Tab = tab ?? (parts.length ? "parts" : "issues");
        return (
          <>
            {partOf.length > 0 && (
              <nav aria-label={t.properties.partOf} className="mb-2 text-sm text-muted">
                {t.properties.partOf}
                {partOf.map((a, i) => (
                  <span key={a.id}>
                    {i > 0 && " › "}
                    <EntityLink to={`/properties/${a.id}`}>{`${t.propertyKinds[a.kind]} ${propertyLabel(a)}`}</EntityLink>
                  </span>
                ))}
              </nav>
            )}
            <PageHeader
              title={`${propertyLabel(p)}, ${p.city}`}
              intro={`${t.propertyKinds[p.kind]} · #${p.number}`}
              actions={
                <div className="text-end">
                  <OccupancyBadge p={p} />
                </div>
              }
            />
            <div className="mb-8 grid gap-6 lg:grid-cols-3">
              <Card title={t.properties.details} className="lg:col-span-2">
                <Fields
                  items={[
                    [t.properties.unit, p.unit],
                    [t.properties.floor, p.floor],
                    [t.properties.area, p.areaSqm && `${p.areaSqm} ${t.properties.sqm}`],
                    [t.properties.rooms, p.rooms],
                    [t.common.notes, p.notes],
                  ]}
                />
              </Card>
              <Card title={t.properties.owners}>
                <ul className="space-y-2">
                  {p.owners.map((o) => (
                    <li key={o.customer.id} className="flex justify-between gap-2">
                      <EntityLink to={`/customers/${o.customer.id}`}>{o.customer.name}</EntityLink>
                      <span className="text-muted">{o.sharePercent}%</span>
                    </li>
                  ))}
                </ul>
                {p.ownersFrom && (
                  <p className="mt-3 text-xs text-muted">
                    {t.properties.inheritedFrom}
                    <EntityLink to={`/properties/${p.ownersFrom.id}`}>{propertyLabel(p.ownersFrom)}</EntityLink>
                  </p>
                )}
              </Card>
            </div>

            <Tabs<Tab>
              label={propertyLabel(p)}
              active={active}
              onChange={setTab}
              tabs={[
                ...(parts.length ? [{ key: "parts" as const, label: t.properties.tabs.parts, count: parts.length }] : []),
                { key: "issues", label: t.properties.tabs.issues, count: issues.filter((i) => i.status !== "closed" && i.status !== "cancelled").length },
                { key: "leases", label: t.properties.tabs.leases, count: leases.length },
                { key: "history", label: t.properties.tabs.history },
              ]}
            />
            <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`}>
              {active === "parts" && <PropertyTable rows={parts} hideOwner />}
              {active === "issues" && (
                <>
                  {parts.length > 0 && <p className="mb-2 text-sm text-muted">{t.properties.includesParts}</p>}
                  <IssueTable issues={issues} hide={["customer"]} />
                </>
              )}
              {active === "leases" &&
                (leases.length ? (
                  <Table head={[t.nav.tenants, t.common.since, t.common.until, t.customers.rent, t.common.status]}>
                    {leases.map((l) => {
                      const status = l.endDate < today ? "ended" : l.startDate > today ? "upcoming" : "active";
                      return (
                        <tr key={l.id}>
                          <Td>
                            <EntityLink to={`/tenants/${l.tenant.id}`}>{l.tenant.name}</EntityLink>
                          </Td>
                          <Td>{fmt.date(l.startDate)}</Td>
                          <Td>{fmt.date(l.endDate)}</Td>
                          <Td>{fmt.money(l.monthlyRentMinor)}</Td>
                          <Td>
                            <Badge color={status === "active" ? "green" : "gray"}>{t.properties.leaseStatus[status]}</Badge>
                          </Td>
                        </tr>
                      );
                    })}
                  </Table>
                ) : (
                  <Empty />
                ))}
              {active === "history" && <History history={history} showProperty={parts.length > 0} />}
            </div>
          </>
        );
      }}
    </Loaded>
  );
}
