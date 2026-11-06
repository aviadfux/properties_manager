import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useParams, useSearchParams } from "react-router";
import { IssueTable } from "@/components/IssueTable";
import { Badge, Card, EntityLink, Fields, Loaded, PageHeader, StatusBadge, UrgencyBadge } from "@/components/ui";
import { getIssue, listIssues, professionalOptions, propertyLabel, setIssueProfessional, type IssueFilter, type IssueRow } from "@/data/api";
import { ISSUE_STATUSES, type IssueStatus, type Urgency } from "@/domain/types";
import { useI18n } from "@/i18n";
import { Rating, select as selectClass, Trades } from "./Professionals";

const URGENCIES: Urgency[] = ["emergency", "high", "normal", "low"];

export function Issues() {
  const { t } = useI18n();
  // Filters live in the URL, so dashboard links like /issues?status=awaiting_approval open a filtered list.
  const [params, setParams] = useSearchParams();
  const filter: IssueFilter = {
    status: (params.get("status") as IssueFilter["status"]) ?? "open",
    urgency: (params.get("urgency") as Urgency) || undefined,
    q: params.get("q") ?? undefined,
  };
  const query = useQuery({ queryKey: ["issues", filter], queryFn: () => listIssues(filter) });

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  const select = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200";

  return (
    <>
      <PageHeader title={t.issues.title} intro={t.issues.intro} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="f-status" className="block text-xs font-semibold text-muted">
            {t.issues.filters.status}
          </label>
          <select id="f-status" className={select} value={filter.status ?? ""} onChange={(e) => update("status", e.target.value)}>
            <option value="open">{t.issues.filters.open}</option>
            <option value="closed">{t.issues.filters.closed}</option>
            <option value="all">{t.common.all}</option>
            {ISSUE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t.issueStatus[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-urgency" className="block text-xs font-semibold text-muted">
            {t.issues.filters.urgency}
          </label>
          <select id="f-urgency" className={select} value={filter.urgency ?? ""} onChange={(e) => update("urgency", e.target.value)}>
            <option value="">{t.common.all}</option>
            {URGENCIES.map((u) => (
              <option key={u} value={u}>
                {t.urgency[u]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-48 flex-1">
          <label htmlFor="f-q" className="block text-xs font-semibold text-muted">
            {t.issues.filters.search}
          </label>
          <input id="f-q" type="search" className={`${select} w-full`} value={filter.q ?? ""} onChange={(e) => update("q", e.target.value)} />
        </div>
      </div>
      <Loaded query={query}>
        {(rows) => (
          <>
            <p className="mb-2 text-sm text-muted" role="status">
              {t.issues.count(rows.length)}
            </p>
            <IssueTable issues={rows} />
          </>
        )}
      </Loaded>
    </>
  );
}

// The main path of the lifecycle (spec §7), shown as progress on the issue card.
const PATH: IssueStatus[] = ["new", "under_review", "awaiting_quote", "awaiting_approval", "approved", "scheduled", "in_progress", "awaiting_signoff", "closed"];

function Progress({ status }: { status: IssueStatus }) {
  const { t } = useI18n();
  if (status === "cancelled") return <StatusBadge status="cancelled" />;
  const current = PATH.indexOf(status);
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label={t.issues.lifecycle}>
      {PATH.map((s, i) => (
        <li
          key={s}
          aria-current={i === current ? "step" : undefined}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            i < current ? "bg-brand-100 text-brand-800" : i === current ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-500"
          }`}
        >
          {t.issueStatus[s]}
        </li>
      ))}
    </ol>
  );
}

/** The professional doing the work: shows the current one and lets the manager pick, best matches first. */
function ProfessionalCard({ issue }: { issue: IssueRow }) {
  const { t, fmt } = useI18n();
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [choice, setChoice] = useState(issue.professionalId ?? "");
  const options = useQuery({ queryKey: ["professional-options", issue.id], queryFn: () => professionalOptions(issue.id), enabled: editing });
  const save = useMutation({
    mutationFn: (id: string | undefined) => setIssueProfessional(issue.id, id),
    onSuccess: () => {
      setEditing(false);
      return client.invalidateQueries();
    },
  });
  const pro = issue.professional;
  const open = issue.status !== "closed" && issue.status !== "cancelled";
  const matches = options.data?.filter((o) => o.matchesTrade && o.matchesArea) ?? [];
  const others = options.data?.filter((o) => !(o.matchesTrade && o.matchesArea)) ?? [];
  const note = (o: (typeof others)[number]) =>
    [o.matchesTrade && t.issues.matchesTrade, o.matchesArea && t.issues.matchesArea].filter(Boolean).join(", ") || t.issues.noMatch;

  return (
    <Card
      title={t.issues.professional}
      action={
        open &&
        !editing && (
          <button type="button" onClick={() => setEditing(true)} className="text-sm font-semibold text-brand-700 hover:underline">
            {pro ? t.forms.edit : t.issues.chooseProfessional}
          </button>
        )
      }
    >
      {pro ? (
        <div className="space-y-1 text-sm">
          <p>
            <EntityLink to={`/professionals/${pro.id}`}>{pro.name}</EntityLink>
            <span className="ms-2">
              <Rating value={pro.rating} />
            </span>
          </p>
          <p dir="ltr" className="text-start text-muted">
            {fmt.phone(pro.phone)}
          </p>
          <Trades trades={pro.trades} />
        </div>
      ) : (
        <p className="text-sm text-muted">{t.issues.noProfessional}</p>
      )}
      {editing && (
        <form
          className="mt-4 space-y-3 border-t border-slate-100 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(choice || undefined);
          }}
        >
          <label htmlFor="pro-choice" className="block text-xs font-semibold text-muted">
            {t.issues.chooseProfessional}
          </label>
          <select id="pro-choice" className={`${selectClass} w-full`} value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="">{t.issues.noProfessional}</option>
            {matches.length > 0 && (
              <optgroup label={t.issues.suggested}>
                {matches.map((o) => (
                  <option key={o.id} value={o.id}>
                    {`${o.name}${o.rating ? ` · ${"★".repeat(o.rating)}` : ""}${o.nearbyNow ? ` · ${t.issues.nearbyNow(o.nearbyNow)}` : ""} · ${t.professionals.openJobs}: ${o.openJobs}`}
                  </option>
                ))}
              </optgroup>
            )}
            {others.length > 0 && (
              <optgroup label={t.issues.others}>
                {others.map((o) => (
                  <option key={o.id} value={o.id}>
                    {`${o.name} (${note(o)})`}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {options.isSuccess && !matches.length && <p className="text-xs text-amber-900">{t.issues.noMatch}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={save.isPending} className="rounded-full bg-brand-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-800">
              {t.forms.save}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-full px-4 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50">
              {t.nav.close}
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}

export function IssueDetail() {
  const { id = "" } = useParams();
  const { t, fmt } = useI18n();
  const query = useQuery({ queryKey: ["issue", id], queryFn: () => getIssue(id) });

  return (
    <Loaded query={query}>
      {({ issue: i, partOf, events }) => (
        <>
          <PageHeader
            title={`#${i.number} ${i.title}`}
            intro={`${t.categories[i.category]}${i.location ? ` · ${i.location}` : ""}`}
            actions={
              <div className="flex gap-2">
                <UrgencyBadge urgency={i.urgency} />
                <StatusBadge status={i.status} />
              </div>
            }
          />
          <Card title={t.issues.lifecycle} className="mb-6">
            <Progress status={i.status} />
          </Card>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <Fields
                items={[
                  [
                    t.issues.property,
                    <>
                      <EntityLink to={`/properties/${i.property.id}`}>{`${propertyLabel(i.property)}, ${i.property.city}`}</EntityLink>
                      {partOf.length > 0 && (
                        <span className="block text-xs text-muted">{`${t.properties.partOf}${partOf.map(propertyLabel).join(" › ")}`}</span>
                      )}
                    </>,
                  ],
                  [t.issues.customer, <EntityLink to={`/customers/${i.customer.id}`}>{i.customer.name}</EntityLink>],
                  [
                    t.issues.reporter,
                    i.reporter.type === "user" ? (
                      i.reporter.name
                    ) : (
                      <EntityLink to={`/${i.reporter.type === "tenant" ? "tenants" : "customers"}/${i.reporter.id}`}>{i.reporter.name}</EntityLink>
                    ),
                  ],
                  [t.issues.assignee, i.assignee?.name ?? t.issues.unassigned],
                  [t.issues.opened, fmt.dateTime(i.openedAt)],
                  [t.issues.description, i.description || null],
                  // Closing details only exist once the issue is closed or cancelled.
                  ...(i.closedAt
                    ? ([
                        [t.issues.closedAt, fmt.dateTime(i.closedAt)],
                        [t.issues.resolution, i.resolution],
                        [t.issues.actualCost, i.actualCostMinor !== undefined ? fmt.money(i.actualCostMinor) : null],
                      ] as [string, ReactNode][])
                    : []),
                ]}
              />
            </Card>
            <div className="space-y-6">
            <ProfessionalCard key={i.professionalId ?? "none"} issue={i} />
            <Card title={t.issues.history}>
              {events.length ? (
                <ol className="space-y-4 border-s-2 border-brand-100 ps-4">
                  {events.map((e) => (
                    <li key={e.id}>
                      <p className="text-xs text-muted">
                        {fmt.dateTime(e.at)} · {e.actorName}
                        {e.internal && (
                          <span className="ms-2">
                            <Badge color="amber">{t.issues.internal}</Badge>
                          </span>
                        )}
                      </p>
                      {e.kind === "status" && e.fromStatus && e.toStatus && (
                        <p className="text-sm font-semibold">{t.issues.statusChange(t.issueStatus[e.fromStatus], t.issueStatus[e.toStatus])}</p>
                      )}
                      {e.kind === "professional" && (
                        <p className="text-sm font-semibold">{e.professionalName ? t.issues.professionalSet(e.professionalName) : t.issues.professionalCleared}</p>
                      )}
                      {e.body && <p className="text-sm">{e.body}</p>}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted">{t.common.noItems}</p>
              )}
            </Card>
            </div>
          </div>
        </>
      )}
    </Loaded>
  );
}
