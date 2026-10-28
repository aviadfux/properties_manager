import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router";
import { IssueTable } from "@/components/IssueTable";
import { Badge, Card, Empty, EntityLink, Fields, Loaded, Ltr, PageHeader, Table, Tabs, Td } from "@/components/ui";
import { getCustomer, listCustomers } from "@/data/api";
import { useI18n } from "@/i18n";
import { PropertyTable } from "./Properties";

export function Customers() {
  const { t, fmt } = useI18n();
  const query = useQuery({ queryKey: ["customers"], queryFn: listCustomers });
  return (
    <>
      <PageHeader title={t.customers.title} intro={t.customers.intro} />
      <Loaded query={query}>
        {(rows) => (
          <Table head={[t.common.number, t.common.name, t.common.phone, t.customers.properties, t.customers.tenants, t.customers.openIssues]}>
            {rows.map((c) => (
              <tr key={c.id}>
                <Td className="text-muted">{c.number}</Td>
                <Td>
                  <EntityLink to={`/customers/${c.id}`}>{c.name}</EntityLink>
                  <div className="text-xs text-muted">{t.kinds[c.kind]}</div>
                </Td>
                <Td>
                  <Ltr>{fmt.phone(c.phone)}</Ltr>
                </Td>
                <Td>{c.properties}</Td>
                <Td>{c.tenants}</Td>
                <Td>
                  <span className="font-semibold">{c.openIssues}</span>
                  {c.urgentIssues > 0 && (
                    <span className="ms-2">
                      <Badge color="red">{t.dashboard.urgentCount(c.urgentIssues)}</Badge>
                    </span>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Loaded>
    </>
  );
}

type Tab = "properties" | "tenants" | "issues" | "details";

export function CustomerDetail() {
  const { id = "" } = useParams();
  const { t, fmt } = useI18n();
  const query = useQuery({ queryKey: ["customer", id], queryFn: () => getCustomer(id) });
  const [tab, setTab] = useState<Tab>("issues");

  return (
    <Loaded query={query}>
      {({ customer: c, properties, tenants, issues, pastProperties }) => {
        const openIssues = issues.filter((i) => i.status !== "closed" && i.status !== "cancelled");
        return (
          <>
            <PageHeader
              title={c.name}
              intro={`${t.kinds[c.kind]} · #${c.number}`}
              actions={
                <div className="flex flex-wrap gap-2 text-sm">
                  <a href={`tel:${c.phone}`} className="rounded-full border border-brand-200 px-4 py-1.5 font-semibold text-brand-700 hover:bg-brand-50">
                    <Ltr>{fmt.phone(c.phone)}</Ltr>
                  </a>
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="rounded-full border border-brand-200 px-4 py-1.5 font-semibold text-brand-700 hover:bg-brand-50">
                      {c.email}
                    </a>
                  )}
                </div>
              }
            />
            <Tabs<Tab>
              label={c.name}
              active={tab}
              onChange={setTab}
              tabs={[
                { key: "issues", label: t.customers.tabs.issues, count: openIssues.length },
                { key: "properties", label: t.customers.tabs.properties, count: properties.length },
                { key: "tenants", label: t.customers.tabs.tenants, count: tenants.length },
                { key: "details", label: t.customers.tabs.details },
              ]}
            />
            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
              {tab === "issues" && <IssueTable issues={issues} hide={["customer"]} />}
              {tab === "properties" && (
                <>
                  <PropertyTable rows={properties} hideOwner />
                  {pastProperties.length > 0 && (
                    <Card title={t.customers.pastProperties} className="mt-6">
                      <ul className="space-y-1 text-sm">
                        {pastProperties.map(({ property: p, endDate }) => (
                          <li key={p.id}>
                            <EntityLink to={`/properties/${p.id}`}>{`${p.address}, ${p.city}`}</EntityLink>
                            <span className="ms-2 text-muted">
                              {t.customers.soldOn}
                              {fmt.date(endDate)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}
                </>
              )}
              {tab === "tenants" &&
                (tenants.length ? (
                  <Table head={[t.common.name, t.tenants.property, t.common.phone, t.customers.rent, t.customers.leaseEnds]}>
                    {tenants.map(({ tenant, lease }) => (
                      <tr key={lease.id}>
                        <Td>
                          <EntityLink to={`/tenants/${tenant.id}`}>{tenant.name}</EntityLink>
                        </Td>
                        <Td>
                          <EntityLink to={`/properties/${lease.property.id}`}>{`${lease.property.address}, ${lease.property.city}`}</EntityLink>
                        </Td>
                        <Td>
                          <Ltr>{fmt.phone(tenant.phone)}</Ltr>
                        </Td>
                        <Td>{fmt.money(lease.monthlyRentMinor)}</Td>
                        <Td>
                          {fmt.date(lease.endDate)}
                          <div className="text-xs text-muted">{t.common.inDays(lease.daysLeft)}</div>
                        </Td>
                      </tr>
                    ))}
                  </Table>
                ) : (
                  <Empty />
                ))}
              {tab === "details" && (
                <Card>
                  <Fields
                    items={[
                      [t.common.phone, <Ltr>{fmt.phone(c.phone)}</Ltr>],
                      [t.common.email, c.email],
                      [t.customers.taxId, c.taxId],
                      [t.customers.billingAddress, c.billingAddress],
                      [t.customers.preferredChannel, t.channels[c.preferredChannel]],
                      [t.customers.preferredLanguage, c.preferredLanguage === "he" ? "עברית" : "English"],
                      [t.common.notes, c.notes],
                    ]}
                  />
                </Card>
              )}
            </div>
          </>
        );
      }}
    </Loaded>
  );
}
