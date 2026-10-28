import { Link } from "react-router";
import type { TodoItem } from "@/data/api";
import { useI18n } from "@/i18n";
import { Icon, type IconName } from "./icons";
import { Empty, UrgencyBadge } from "./ui";

const ICON: Record<TodoItem["kind"], { name: IconName; tone: string }> = {
  urgent_issue: { name: "alert", tone: "bg-red-100 text-red-800" },
  approval: { name: "clock", tone: "bg-amber-100 text-amber-900" },
  verify_payment: { name: "coin", tone: "bg-sky-100 text-sky-800" },
  lease_ending: { name: "file", tone: "bg-slate-100 text-slate-700" },
};

/** The "Needs attention" list: shared by the dashboard strip (limit) and the full To-do page. */
export function TodoList({ items, limit }: { items: TodoItem[]; limit?: number }) {
  const { t, fmt } = useI18n();
  const shown = limit ? items.slice(0, limit) : items;
  if (!shown.length) return <Empty>{t.dashboard.allClear}</Empty>;

  function describe(item: TodoItem) {
    switch (item.kind) {
      case "urgent_issue":
        return {
          title: `#${item.issue.number} ${item.issue.title}`,
          sub: `${item.issue.property.address}, ${item.issue.property.city} · ${t.common.daysAgo(fmt.daysSince(item.issue.openedAt))}`,
          badge: <UrgencyBadge urgency={item.issue.urgency} />,
          to: `/issues/${item.issue.id}`,
          action: t.todo.actions.open,
        };
      case "approval":
        return {
          title: `#${item.issue.number} ${item.issue.title}`,
          sub: `${item.issue.customer.name} · ${t.todo.waiting(item.waitingDays)}`,
          badge: null,
          to: `/issues/${item.issue.id}`,
          action: t.todo.actions.review,
        };
      case "verify_payment":
        return {
          title: `${fmt.money(item.amountMinor)} · ${item.customer.name}`,
          sub: `${t.todo.bankTransfer} · ${t.todo.reported} ${t.common.daysAgo(fmt.daysSince(item.reportedAt))}`,
          badge: null,
          to: `/customers/${item.customer.id}`,
          action: t.todo.actions.verify,
        };
      case "lease_ending":
        return {
          title: `${item.lease.property.address}, ${item.lease.property.city} · ${item.lease.tenant.name}`,
          sub: `${fmt.date(item.lease.endDate)} · ${t.common.inDays(item.lease.daysLeft)}`,
          badge: null,
          to: `/properties/${item.lease.property.id}`,
          action: t.todo.actions.view,
        };
    }
  }

  return (
    <ul className="divide-y divide-slate-100">
      {shown.map((item, i) => {
        const d = describe(item);
        const icon = ICON[item.kind];
        return (
          <li key={i} className="flex items-center gap-3 py-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${icon.tone}`}>
              <Icon name={icon.name} className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-muted">{t.todo[item.kind]}</p>
              <p className="truncate font-semibold text-ink">{d.title}</p>
              <p className="truncate text-sm text-muted">{d.sub}</p>
            </div>
            {d.badge && <span className="hidden sm:block">{d.badge}</span>}
            <Link
              to={d.to}
              className="shrink-0 rounded-full border border-brand-200 px-4 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"
            >
              {d.action}
              <span className="sr-only">: {d.title}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
