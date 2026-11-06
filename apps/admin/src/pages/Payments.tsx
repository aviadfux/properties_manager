import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChannelBadge, WhatsAppSendButton } from "@/components/Channel";
import { Badge, Card, Empty, EntityLink, Loaded, Ltr, PageHeader, Table, Tabs, Td, type Tone } from "@/components/ui";
import {
  listPaymentRequests,
  listReminderRules,
  sendPaymentReminder,
  setPaymentRequestPaused,
  setReminderRuleActive,
  type PaymentRequestFilter,
  type PaymentRequestRow,
} from "@/data/api";
import type { OutgoingMessage, PaymentRequestStatus } from "@/domain/types";
import { useI18n } from "@/i18n";
import { select } from "./Professionals";

const statusTone: Record<PaymentRequestStatus, Tone> = {
  scheduled: "gray",
  sent: "blue",
  partially_paid: "amber",
  paid: "green",
  paused: "gray",
  cancelled: "gray",
};

const btn = "rounded-full border border-brand-200 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50";

function RequestActions({ r }: { r: PaymentRequestRow }) {
  const { t } = useI18n();
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries();
  const send = useMutation({ mutationFn: () => sendPaymentReminder(r.id), onSuccess: refresh });
  const pause = useMutation({ mutationFn: (reason?: string) => setPaymentRequestPaused(r.id, r.status !== "paused", reason), onSuccess: refresh });

  if (r.status === "paid" || r.status === "cancelled") return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {r.ready && r.status !== "paused" && <WhatsAppSendButton message={r.ready} />}
      {r.status !== "paused" && !r.ready && (
        <button type="button" className={btn} disabled={send.isPending} onClick={() => send.mutate()}>
          {send.isPending ? t.payments.sending : send.isSuccess ? t.payments.sent : t.payments.sendNow}
        </button>
      )}
      <button
        type="button"
        className={btn}
        disabled={pause.isPending}
        onClick={() => {
          if (r.status === "paused") return pause.mutate(undefined);
          const reason = window.prompt(t.payments.pauseReason);
          if (reason !== null) pause.mutate(reason || undefined);
        }}
      >
        {r.status === "paused" ? t.payments.resume : t.payments.pause}
      </button>
    </div>
  );
}

/** Payment requests with their reminder state; also used on the customer card. */
export function PaymentRequestTable({ rows, hideCustomer = false }: { rows: PaymentRequestRow[]; hideCustomer?: boolean }) {
  const { t, fmt } = useI18n();
  if (!rows.length) return <Empty />;
  return (
    <Table
      head={[
        t.payments.number,
        ...(hideCustomer ? [] : [t.payments.customer]),
        t.payments.description,
        t.payments.amount,
        t.payments.due,
        t.payments.status,
        t.payments.nextReminder,
        "",
      ]}
    >
      {rows.map((r) => (
        <tr key={r.id} className={r.overdueDays > 14 && r.status !== "paused" ? "bg-red-50/50" : ""}>
          <Td className="text-muted">{r.number}</Td>
          {!hideCustomer && (
            <Td>
              <EntityLink to={`/customers/${r.customer.id}`}>{r.customer.name}</EntityLink>
              <div className="mt-1">
                <ChannelBadge channel={r.customer.preferredChannel} />
              </div>
            </Td>
          )}
          <Td className="max-w-64">{r.description}</Td>
          <Td className="whitespace-nowrap">
            {fmt.money(r.amountMinor)}
            {r.paidMinor > 0 && r.balanceMinor > 0 && (
              <div className="text-xs text-muted">
                {t.payments.balance}: {fmt.money(r.balanceMinor)}
              </div>
            )}
          </Td>
          <Td className="whitespace-nowrap">
            {fmt.date(r.dueDate)}
            {r.overdueDays > 0 && <div className="text-xs font-semibold text-red-700">{t.payments.overdue(r.overdueDays)}</div>}
          </Td>
          <Td>
            <Badge color={statusTone[r.status]}>{t.payments.statuses[r.status]}</Badge>
            {r.pausedReason && <div className="mt-1 max-w-48 text-xs text-muted">{r.pausedReason}</div>}
          </Td>
          <Td className="text-sm">
            {r.nextReminder ? (
              <>
                {fmt.date(r.nextReminder.date)}
                <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted">
                  <ChannelBadge channel={r.nextReminder.channel} />
                  {r.nextReminder.templateName}
                </div>
              </>
            ) : (
              <span className="text-muted">{t.payments.noReminder}</span>
            )}
            {r.messages[0] && (
              <div className="mt-1 text-xs text-muted">
                {t.payments.lastMessage}: {fmt.dateTime(r.messages[0].at)}
              </div>
            )}
          </Td>
          <Td>
            <RequestActions r={r} />
          </Td>
        </tr>
      ))}
    </Table>
  );
}

export function MessageLog({ messages }: { messages: (OutgoingMessage & { customerName: string; requestNumber: number })[] }) {
  const { t, fmt } = useI18n();
  if (!messages.length) return <Empty />;
  return (
    <ul className="space-y-3">
      {messages.map((m) => (
        <li key={m.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>{fmt.dateTime(m.at)}</span>
            <ChannelBadge channel={m.channel} />
            <Badge color={m.status === "failed" ? "red" : m.status === "ready" ? "amber" : "gray"}>{t.payments.messageStatus[m.status]}</Badge>
            {!m.ruleId && <Badge color="amber">{t.payments.manual}</Badge>}
            <span>
              <EntityLink to={`/customers/${m.customerId}`}>{m.customerName}</EntityLink> · #{m.requestNumber} · <Ltr>{m.channel === "whatsapp" ? fmt.phone(m.to) : m.to}</Ltr>
            </span>
          </p>
          <p className="whitespace-pre-line text-sm">{m.body}</p>
          {m.status === "ready" && (
            <div className="mt-2">
              <WhatsAppSendButton message={m} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function Schedule() {
  const { t } = useI18n();
  const client = useQueryClient();
  const rules = useQuery({ queryKey: ["reminder-rules"], queryFn: listReminderRules });
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setReminderRuleActive(id, active),
    onSuccess: () => client.invalidateQueries(),
  });
  return (
    <Loaded query={rules}>
      {(rows) => (
        <Table head={[t.payments.active, t.payments.whenLabel, t.payments.channel, t.payments.template]}>
          {rows.map((r) => (
            <tr key={r.id} className={r.active ? "" : "opacity-60"}>
              <Td>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-700"
                  checked={r.active}
                  aria-label={t.payments.when(r.anchor, r.offsetDays)}
                  onChange={(e) => toggle.mutate({ id: r.id, active: e.target.checked })}
                />
              </Td>
              <Td className="font-semibold">{t.payments.when(r.anchor, r.offsetDays)}</Td>
              <Td>{r.channel === "preferred" ? t.payments.channelPreferred : <ChannelBadge channel={r.channel} />}</Td>
              <Td>
                <EntityLink to={`/forms/${r.template.id}`}>{r.template.name}</EntityLink>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </Loaded>
  );
}

type Tab = "requests" | "schedule" | "messages";

export function Payments() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("requests");
  const [status, setStatus] = useState<NonNullable<PaymentRequestFilter["status"]>>("open");
  const requests = useQuery({ queryKey: ["payment-requests", status], queryFn: () => listPaymentRequests({ status }) });
  const all = useQuery({ queryKey: ["payment-requests", "all"], queryFn: () => listPaymentRequests({ status: "all" }) });
  const messages = (all.data ?? [])
    .flatMap((r) => r.messages.map((m) => ({ ...m, customerName: r.customer.name, requestNumber: r.number })))
    .sort((a, b) => b.at.localeCompare(a.at));
  const readyCount = messages.filter((m) => m.status === "ready").length;

  return (
    <>
      <PageHeader title={t.payments.title} intro={t.payments.intro} />
      <Card className="mb-6">
        <p className="text-sm">{t.payments.autoNote}</p>
        <p className="mt-1 text-xs text-amber-900">{t.payments.sampleNote}</p>
        {readyCount > 0 && (
          <button
            type="button"
            onClick={() => setTab("messages")}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100"
          >
            {t.payments.readyCount(readyCount)}
          </button>
        )}
      </Card>
      <Tabs<Tab>
        label={t.payments.title}
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "requests", label: t.payments.tabs.requests },
          { key: "schedule", label: t.payments.tabs.schedule },
          { key: "messages", label: t.payments.tabs.messages, count: messages.length },
        ]}
      />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "requests" && (
          <>
            <div className="mb-4">
              <label htmlFor="f-pr-status" className="block text-xs font-semibold text-muted">
                {t.payments.status}
              </label>
              <select id="f-pr-status" className={select} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                {(["open", "overdue", "all"] as const).map((s) => (
                  <option key={s} value={s}>
                    {t.payments.filters[s]}
                  </option>
                ))}
              </select>
            </div>
            <Loaded query={requests}>
              {(rows) => (
                <>
                  <p className="mb-2 text-sm text-muted" role="status">
                    {t.payments.count(rows.length)}
                  </p>
                  <PaymentRequestTable rows={rows} />
                </>
              )}
            </Loaded>
          </>
        )}
        {tab === "schedule" && <Schedule />}
        {tab === "messages" && <Loaded query={all}>{() => <MessageLog messages={messages} />}</Loaded>}
      </div>
    </>
  );
}
