import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { IssueTable } from "@/components/IssueTable";
import { Badge, Card, EntityLink, Fields, Loaded, PageHeader, Table, Td } from "@/components/ui";
import { getProperty, listProperties, type PropertyRow } from "@/data/api";
import { useI18n } from "@/i18n";

export function PropertyTable({ rows, hideOwner = false }: { rows: PropertyRow[]; hideOwner?: boolean }) {
  const { t } = useI18n();
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
        <tr key={p.id}>
          <Td className="text-muted">{p.number}</Td>
          <Td>
            <EntityLink to={`/properties/${p.id}`}>{`${p.address}${p.unit ? ` / ${p.unit}` : ""}`}</EntityLink>
            <div className="text-xs text-muted">{p.city}</div>
          </Td>
          <Td>{t.propertyKinds[p.kind]}</Td>
          {!hideOwner && (
            <Td>
              {p.owners.map((o) => (
                <div key={o.customer.id}>
                  <EntityLink to={`/customers/${o.customer.id}`}>{o.customer.name}</EntityLink>
                  {o.sharePercent < 100 && <span className="ms-1 text-xs text-muted">({o.sharePercent}%)</span>}
                </div>
              ))}
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
            <Badge color={p.occupancy === "occupied" ? "green" : "amber"}>{t.occupancy[p.occupancy]}</Badge>
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

export function PropertyDetail() {
  const { id = "" } = useParams();
  const { t, fmt } = useI18n();
  const query = useQuery({ queryKey: ["property", id], queryFn: () => getProperty(id) });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Loaded query={query}>
      {({ property: p, leases, issues }) => (
        <>
          <PageHeader
            title={`${p.address}${p.unit ? ` / ${p.unit}` : ""}, ${p.city}`}
            intro={`${t.propertyKinds[p.kind]} · #${p.number}`}
            actions={<Badge color={p.occupancy === "occupied" ? "green" : "amber"}>{t.occupancy[p.occupancy]}</Badge>}
          />
          <div className="grid gap-6 lg:grid-cols-3">
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
            </Card>
          </div>

          <h2 className="mb-3 mt-8 font-bold text-brand-900">{t.issues.title}</h2>
          <IssueTable issues={issues} hide={["property", "customer"]} />

          <h2 className="mb-3 mt-8 font-bold text-brand-900">{t.properties.leases}</h2>
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
        </>
      )}
    </Loaded>
  );
}
