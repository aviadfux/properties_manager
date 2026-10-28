import type { IssueRow } from "@/data/api";
import { useI18n } from "@/i18n";
import { Empty, EntityLink, StatusBadge, Table, Td, UrgencyBadge } from "./ui";

type Column = "property" | "customer" | "reporter" | "assignee";

/** Issues with links to their property and customer; columns can be hidden when the context makes them redundant. */
export function IssueTable({ issues, hide = [] }: { issues: IssueRow[]; hide?: Column[] }) {
  const { t, fmt } = useI18n();
  if (!issues.length) return <Empty />;
  const show = (c: Column) => !hide.includes(c);
  return (
    <Table
      caption={t.issues.title}
      head={[
        "#",
        t.issues.subject,
        ...(show("property") ? [t.issues.property] : []),
        ...(show("customer") ? [t.issues.customer] : []),
        t.issues.urgency,
        t.common.status,
        ...(show("reporter") ? [t.issues.reporter] : []),
        ...(show("assignee") ? [t.issues.assignee] : []),
        t.issues.opened,
      ]}
    >
      {issues.map((i) => (
        <tr key={i.id} className={i.urgency === "emergency" && i.status !== "closed" ? "bg-red-50/50" : ""}>
          <Td className="text-muted">{i.number}</Td>
          <Td>
            <EntityLink to={`/issues/${i.id}`}>{i.title}</EntityLink>
            <div className="text-xs text-muted">{t.categories[i.category]}</div>
          </Td>
          {show("property") && (
            <Td>
              <EntityLink to={`/properties/${i.property.id}`}>{i.property.address}</EntityLink>
              <div className="text-xs text-muted">{i.property.city}</div>
            </Td>
          )}
          {show("customer") && (
            <Td>
              <EntityLink to={`/customers/${i.customer.id}`}>{i.customer.name}</EntityLink>
            </Td>
          )}
          <Td>
            <UrgencyBadge urgency={i.urgency} />
          </Td>
          <Td>
            <StatusBadge status={i.status} />
          </Td>
          {show("reporter") && (
            <Td>
              {i.reporter.name}
              <div className="text-xs text-muted">{t.actorTypes[i.reporter.type]}</div>
            </Td>
          )}
          {show("assignee") && <Td>{i.assignee?.name ?? <span className="text-muted">{t.issues.unassigned}</span>}</Td>}
          <Td className="whitespace-nowrap text-muted">{t.common.daysAgo(fmt.daysSince(i.openedAt))}</Td>
        </tr>
      ))}
    </Table>
  );
}
