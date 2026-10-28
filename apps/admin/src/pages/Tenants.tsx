import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { IssueTable } from "@/components/IssueTable";
import { Badge, Card, EntityLink, Fields, Loaded, Ltr, PageHeader, Table, Td } from "@/components/ui";
import { getTenant, listTenants } from "@/data/api";
import { useI18n } from "@/i18n";

export function Tenants() {
  const { t, fmt } = useI18n();
  const query = useQuery({ queryKey: ["tenants"], queryFn: listTenants });
  return (
    <>
      <PageHeader title={t.tenants.title} intro={t.tenants.intro} />
      <Loaded query={query}>
        {(rows) => (
          <Table head={[t.common.number, t.common.name, t.common.phone, t.tenants.property, t.tenants.landlord, t.customers.openIssues]}>
            {rows.map((tn) => (
              <tr key={tn.id}>
                <Td className="text-muted">{tn.number}</Td>
                <Td>
                  <EntityLink to={`/tenants/${tn.id}`}>{tn.name}</EntityLink>
                  <div className="text-xs text-muted">{t.kinds[tn.kind]}</div>
                </Td>
                <Td>
                  <Ltr>{fmt.phone(tn.phone)}</Ltr>
                </Td>
                <Td>
                  {tn.leases.length ? (
                    tn.leases.map((l) => (
                      <div key={l.id}>
                        <EntityLink to={`/properties/${l.property.id}`}>{`${l.property.address}, ${l.property.city}`}</EntityLink>
                      </div>
                    ))
                  ) : (
                    <Badge>{t.tenants.noActiveLease}</Badge>
                  )}
                </Td>
                <Td>
                  {tn.leases.map(
                    (l) =>
                      l.customer && (
                        <div key={l.id}>
                          <EntityLink to={`/customers/${l.customer.id}`}>{l.customer.name}</EntityLink>
                        </div>
                      ),
                  )}
                </Td>
                <Td className="font-semibold">{tn.openIssues}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Loaded>
    </>
  );
}

export function TenantDetail() {
  const { id = "" } = useParams();
  const { t, fmt } = useI18n();
  const query = useQuery({ queryKey: ["tenant", id], queryFn: () => getTenant(id) });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Loaded query={query}>
      {({ tenant: tn, leases, issues }) => (
        <>
          <PageHeader title={tn.name} intro={`${t.kinds[tn.kind]} · #${tn.number}`} />
          <Card className="mb-8">
            <Fields
              items={[
                [t.common.phone, <Ltr>{fmt.phone(tn.phone)}</Ltr>],
                [t.common.email, tn.email],
                [t.customers.preferredLanguage, tn.preferredLanguage === "he" ? "עברית" : "English"],
                [t.common.notes, tn.notes],
              ]}
            />
          </Card>

          <h2 className="mb-3 font-bold text-brand-900">{t.tenants.leases}</h2>
          <Table head={[t.tenants.property, t.tenants.landlord, t.common.since, t.common.until, t.customers.rent, t.common.status]}>
            {leases.map((l) => {
              const status = l.endDate < today ? "ended" : l.startDate > today ? "upcoming" : "active";
              return (
                <tr key={l.id}>
                  <Td>
                    <EntityLink to={`/properties/${l.property.id}`}>{`${l.property.address}, ${l.property.city}`}</EntityLink>
                  </Td>
                  <Td>{l.customer && <EntityLink to={`/customers/${l.customer.id}`}>{l.customer.name}</EntityLink>}</Td>
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

          <h2 className="mb-3 mt-8 font-bold text-brand-900">{t.issues.title}</h2>
          <IssueTable issues={issues} hide={["reporter"]} />
        </>
      )}
    </Loaded>
  );
}
