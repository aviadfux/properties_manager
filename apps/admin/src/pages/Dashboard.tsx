import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { TodoList } from "@/components/TodoList";
import { Card, Loaded, PageHeader, StatusBadge, Table, Td, EntityLink } from "@/components/ui";
import { getDashboard, listTodo } from "@/data/api";
import { useI18n } from "@/i18n";

function Stat({ label, value, sub, to, tone = "text-brand-900" }: { label: string; value: string; sub: string; to: string; tone?: string }) {
  return (
    <Link to={to} className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-brand-200 hover:shadow">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className={`mt-2 text-3xl font-extrabold ${tone}`}>{value}</p>
      <p className="mt-1 text-sm text-muted">{sub}</p>
    </Link>
  );
}

export function Dashboard() {
  const { t, fmt } = useI18n();
  const todo = useQuery({ queryKey: ["todo"], queryFn: listTodo });
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: getDashboard });

  return (
    <>
      <PageHeader title={t.dashboard.title} />

      {/* "Needs attention" strip — the most urgent items first (spec §3). */}
      <Card
        title={`${t.dashboard.needsAttention}${todo.data ? ` (${todo.data.length})` : ""}`}
        action={
          <Link to="/todo" className="text-sm font-semibold text-brand-700 hover:underline">
            {t.common.seeAll}
          </Link>
        }
        className="mb-6 border-amber-200"
      >
        <Loaded query={todo}>{(items) => <TodoList items={items} limit={4} />}</Loaded>
      </Card>

      <Loaded query={dash}>
        {(d) => {
          const c = d.collections;
          const pct = c.dueMinor ? Math.round((c.verifiedMinor / c.dueMinor) * 100) : 0;
          const overdue = d.debtAging.reduce((s, b) => s + b.amountMinor, 0);
          const overdueCustomers = d.debtAging.reduce((s, b) => s + b.customers, 0);
          const maxBucket = Math.max(...d.debtAging.map((b) => b.amountMinor), 1);
          const totalProps = d.occupancy.occupied + d.occupancy.vacant;
          return (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Stat
                  label={t.dashboard.collections}
                  value={fmt.money(c.verifiedMinor)}
                  sub={t.dashboard.collectedOf(pct, fmt.money(c.dueMinor))}
                  to="/customers"
                />
                <Stat
                  label={t.dashboard.overdue}
                  value={fmt.money(overdue)}
                  sub={t.dashboard.overdueCustomers(overdueCustomers)}
                  to="/customers"
                  tone={overdue ? "text-red-800" : "text-brand-900"}
                />
                <Stat
                  label={t.dashboard.openIssues}
                  value={String(d.issues.open)}
                  sub={t.dashboard.urgentCount(d.issues.urgent)}
                  to="/issues?status=open"
                />
                <Stat
                  label={t.dashboard.approvals}
                  value={String(d.issues.awaitingApproval)}
                  sub={d.issues.awaitingApproval ? t.dashboard.oldestWaiting(d.issues.oldestApprovalDays) : t.dashboard.occupancyValue(d.occupancy.occupied, totalProps)}
                  to="/issues?status=awaiting_approval"
                />
              </div>
              {c.unverifiedMinor > 0 && (
                <p className="mt-3 text-sm text-muted">
                  {t.dashboard.unverified(fmt.money(c.unverifiedMinor))} · {t.common.updated} {fmt.dateTime(c.updatedAt)}
                </p>
              )}

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <Card title={t.dashboard.debtAging}>
                  <ul className="space-y-3">
                    {d.debtAging.map((b) => (
                      <li key={b.bucket} className="grid grid-cols-[7rem_1fr_6rem] items-center gap-3 text-sm">
                        <span className="text-muted">{t.dashboard.agingBuckets[b.bucket]}</span>
                        <span className="h-3 rounded-full bg-slate-100">
                          <span
                            className="block h-3 rounded-full bg-brand-600"
                            style={{ width: `${(b.amountMinor / maxBucket) * 100}%` }}
                          />
                        </span>
                        <span className="text-end font-semibold">{fmt.money(b.amountMinor)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-xs text-muted">{t.dashboard.billingSampleNote}</p>
                </Card>

                <Card title={t.dashboard.issuesByStatus}>
                  <ul className="flex flex-wrap gap-2">
                    {d.issues.byStatus.map((s) => (
                      <li key={s.status}>
                        <Link
                          to={`/issues?status=${s.status}`}
                          className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 hover:border-brand-200"
                        >
                          <StatusBadge status={s.status} />
                          <span className="font-bold">{s.count}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>

              <div className="mt-6">
                <h2 className="mb-3 font-bold text-brand-900">{t.dashboard.leasesEnding}</h2>
                <Table head={[t.tenants.property, t.nav.tenants, t.issues.customer, t.customers.rent, t.customers.leaseEnds]}>
                  {d.leasesEnding.map((l) => (
                    <tr key={l.id}>
                      <Td>
                        <EntityLink to={`/properties/${l.property.id}`}>{`${l.property.address}, ${l.property.city}`}</EntityLink>
                      </Td>
                      <Td>
                        <EntityLink to={`/tenants/${l.tenant.id}`}>{l.tenant.name}</EntityLink>
                      </Td>
                      <Td>{l.customer && <EntityLink to={`/customers/${l.customer.id}`}>{l.customer.name}</EntityLink>}</Td>
                      <Td>{fmt.money(l.monthlyRentMinor)}</Td>
                      <Td className={l.daysLeft <= 30 ? "font-semibold text-red-800" : ""}>
                        {fmt.date(l.endDate)} · {t.common.inDays(l.daysLeft)}
                      </Td>
                    </tr>
                  ))}
                </Table>
              </div>
            </>
          );
        }}
      </Loaded>
    </>
  );
}
