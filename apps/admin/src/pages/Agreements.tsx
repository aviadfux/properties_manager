import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { Icon } from "@/components/icons";
import { SensitiveValue } from "@/components/Sensitive";
import { Badge, Card, Empty, EntityLink, Fields, Loaded, PageHeader, Table, Td, type Tone } from "@/components/ui";
import { extractAgreement, normalizePhone, type AgreementExtract, type Found } from "@/data/agreements";
import { compareWithRecord, hasErrors, type Check } from "@/data/checks";
import { DocumentError, readDocumentFile, type DocumentProblem } from "@/data/documents";
import {
  checkAgreementImport,
  checkNewAgreement,
  CheckError,
  createAgreement,
  describeFee,
  getAgreementRecord,
  findCustomerMatches,
  getAgreement,
  getCustomer,
  getFormValues,
  getOrganization,
  importAgreement,
  listAgreements,
  listFormTemplates,
  markAgreementSigned,
  matchProperties,
  propertyLabel,
  type AgreementRow,
  type AgreementStatus,
} from "@/data/api";
import { render } from "@/data/templates";
import { FEE_MODELS, type FeeModel, type Language, type ManagementAgreement, type PartyKind } from "@/domain/types";
import { useI18n } from "@/i18n";
import { redact } from "@/security/sensitive";
import { FormOutput, LANGUAGE_NAMES, primary, secondary } from "./Forms";
import { select } from "./Professionals";

const statusTone: Record<AgreementStatus, Tone> = { draft: "amber", upcoming: "blue", active: "green", ended: "gray" };
/** "1,234.5" → 123450; NaN when it is not a number (the checks then report it). */
const toMinor = (shekels: string) => (shekels.trim() ? Math.round(Number(shekels.replace(/,/g, "")) * 100) : NaN);
const todayIso = () => new Date().toISOString().slice(0, 10);

function useFee() {
  const { t, locale } = useI18n();
  return (a: Pick<ManagementAgreement, "feeModel" | "feeMinor" | "feePercent" | "plusVat" | "billingFrequency">) =>
    `${describeFee(a, locale)}; ${t.agreements.billings[a.billingFrequency ?? "monthly"]}`;
}

export function AgreementTable({ rows, hideCustomer = false }: { rows: AgreementRow[]; hideCustomer?: boolean }) {
  const { t, fmt } = useI18n();
  const fee = useFee();
  if (!rows.length) return <Empty>{t.agreements.none}</Empty>;
  const head = [t.agreements.number, ...(hideCustomer ? [] : [t.agreements.customer]), t.agreements.properties, t.agreements.term, t.agreements.fee, t.agreements.status];
  return (
    <Table head={head}>
      {rows.map((a) => (
        <tr key={a.id}>
          <Td>
            <EntityLink to={`/agreements/${a.id}`}>{`#${a.number}`}</EntityLink>
          </Td>
          {!hideCustomer && (
            <Td>
              <EntityLink to={`/customers/${a.customer.id}`}>{a.customer.name}</EntityLink>
            </Td>
          )}
          <Td>{a.properties.map((p) => `${propertyLabel(p)}, ${p.city}`).join(" · ") || "—"}</Td>
          <Td className="whitespace-nowrap">
            {fmt.date(a.startDate)} – {a.endDate ? fmt.date(a.endDate) : t.agreements.noEnd}
          </Td>
          <Td>{fee(a)}</Td>
          <Td>
            <div className="flex flex-wrap gap-1">
              <Badge color={statusTone[a.status]}>{t.agreements.statuses[a.status]}</Badge>
              {a.source === "imported" && <Badge>{t.agreements.sources.imported}</Badge>}
            </div>
          </Td>
        </tr>
      ))}
    </Table>
  );
}

export function Agreements() {
  const { t } = useI18n();
  const query = useQuery({ queryKey: ["agreements"], queryFn: () => listAgreements() });
  return (
    <>
      <PageHeader
        title={t.agreements.title}
        intro={t.agreements.intro}
        actions={
          <Link to="/agreements/import" className={primary}>
            <Icon name="upload" className="h-4 w-4" />
            {t.agreements.import}
          </Link>
        }
      />
      <Loaded query={query}>{(rows) => <AgreementTable rows={rows} />}</Loaded>
    </>
  );
}

/** The result of the checks: errors block saving, warnings ask for a look. */
function ChecksPanel({ checks }: { checks?: Check[] }) {
  const { t } = useI18n();
  if (!checks) return null;
  const sorted = [...checks].sort((a, b) => (a.level === b.level ? 0 : a.level === "error" ? -1 : 1));
  return (
    <section aria-labelledby="checks-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 id="checks-title" className="mb-3 flex items-center gap-2 font-bold text-brand-900">
        <Icon name="shield" className="h-5 w-5" />
        {t.agreements.checks.title}
      </h2>
      {sorted.length === 0 ? (
        <p className="text-sm text-emerald-800" role="status">
          ✓ {t.agreements.checks.allGood}
        </p>
      ) : (
        <ul className="space-y-1.5 text-sm" role="status">
          {sorted.map((c, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-2">
              <Badge color={c.level === "error" ? "red" : "amber"}>{c.level === "error" ? t.agreements.checks.error : t.agreements.checks.warning}</Badge>
              <span>
                {t.agreements.checks.codes[c.code]} {c.detail && <span className="text-slate-600">{c.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {hasErrors(sorted) && <p className="mt-3 text-sm font-semibold text-red-700">{t.agreements.checks.blocked}</p>}
    </section>
  );
}

/** A failed save: the checks that stopped it, or the message. */
function SaveError({ error }: { error: Error }) {
  return error instanceof CheckError ? (
    <ChecksPanel checks={error.checks} />
  ) : (
    <p className="text-sm text-red-700" role="alert">
      {error.message}
    </p>
  );
}

// ---------- one agreement, and its document ----------

function AgreementDocument({ agreement }: { agreement: AgreementRow }) {
  const { t } = useI18n();
  const templates = useQuery({ queryKey: ["form-templates"], queryFn: listFormTemplates });
  // The agreement itself first, then the other documents made from an agreement (power of attorney, quote).
  const options = (templates.data?.filter((x) => x.context === "agreement" && x.kind === "document") ?? []).sort((a, b) => Number(!!b.importable) - Number(!!a.importable));
  const [templateId, setTemplateId] = useState("");
  const template = options.find((x) => x.id === templateId) ?? options[0];
  const available = (["he", "en"] as Language[]).filter((l) => template?.body[l]?.trim());
  const [chosen, setLanguage] = useState<Language>(agreement.language);
  const language = available.includes(chosen) ? chosen : (available[0] ?? "he");
  const values = useQuery({
    queryKey: ["form-values", "agreement", agreement.id, language],
    queryFn: () => getFormValues("agreement", agreement.id, language),
  });
  const record = useQuery({ queryKey: ["agreement-record", agreement.id, language], queryFn: () => getAgreementRecord(agreement.id, language) });
  const organization = useQuery({ queryKey: ["organization"], queryFn: getOrganization });
  // Reads the generated document back with the import rules and compares it with the record.
  const differences =
    template?.importable && values.data && record.data && organization.data
      ? compareWithRecord(record.data, extractAgreement(render(template.body[language] ?? "", "agreement", values.data).text, organization.data))
      : undefined;

  return (
    <Card title={t.agreements.document}>
      {templates.isSuccess && !template ? (
        <p className="text-sm text-muted">{t.agreements.noTemplate}</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            {options.length > 1 && (
              <div>
                <label htmlFor="ag-template" className="block text-xs font-semibold text-muted">
                  {t.agreements.template}
                </label>
                <select id="ag-template" className={select} value={template?.id} onChange={(e) => setTemplateId(e.target.value)}>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="ag-lang" className="block text-xs font-semibold text-muted">
                {t.agreements.language}
              </label>
              <select id="ag-lang" className={select} value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
                {available.map((l) => (
                  <option key={l} value={l}>
                    {LANGUAGE_NAMES[l]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {differences &&
            (differences.length ? (
              <p className="mb-3 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900" role="status">
                {t.agreements.exportCheck.differs(differences.map((f) => t.agreements.exportCheck.fields[f]).join(", "))}
              </p>
            ) : (
              <p className="mb-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-900" role="status">
                <Icon name="shield" className="h-4 w-4 shrink-0" />
                {t.agreements.exportCheck.ok}
              </p>
            ))}
          {template && values.data && <FormOutput template={template} values={values.data} language={language} fileName={`agreement-${agreement.number}.docx`} />}
        </>
      )}
    </Card>
  );
}

export function AgreementDetail() {
  const { id = "" } = useParams();
  const { t, fmt } = useI18n();
  const location = useLocation();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["agreement", id], queryFn: () => getAgreement(id) });
  const sign = useMutation({ mutationFn: () => markAgreementSigned(id), onSuccess: () => client.invalidateQueries() });
  const fee = useFee();
  const notice = (location.state as { notice?: string } | null)?.notice;

  return (
    <Loaded query={query}>
      {(a) => (
        <>
          <PageHeader
            title={`${t.agreements.title} #${a.number}`}
            intro={a.customer.name}
            actions={
              a.status === "draft" && (
                <button type="button" className={primary} disabled={sign.isPending} onClick={() => sign.mutate()}>
                  {t.agreements.markSigned}
                </button>
              )
            }
          />
          {notice && (
            <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-900" role="status">
              {notice}
            </p>
          )}
          <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
            <Card>
              <Fields
                items={[
                  [t.agreements.status, <Badge color={statusTone[a.status]}>{t.agreements.statuses[a.status]}</Badge>],
                  [t.agreements.customer, <EntityLink to={`/customers/${a.customer.id}`}>{a.customer.name}</EntityLink>],
                  [t.customers.taxId, a.customer.taxId && <SensitiveValue value={a.customer.taxId} />],
                  [
                    t.agreements.properties,
                    a.properties.length ? (
                      <ul>
                        {a.properties.map((p) => (
                          <li key={p.id}>
                            <EntityLink to={`/properties/${p.id}`}>{`${propertyLabel(p)}, ${p.city}`}</EntityLink>
                          </li>
                        ))}
                      </ul>
                    ) : undefined,
                  ],
                  [t.agreements.start, fmt.date(a.startDate)],
                  [t.agreements.end, a.endDate ? fmt.date(a.endDate) : t.agreements.noEnd],
                  [t.agreements.fee, fee(a)],
                  [t.agreements.approvalThreshold, a.approvalThresholdMinor === undefined ? undefined : fmt.money(a.approvalThresholdMinor)],
                  [t.agreements.signedAt, a.signedAt ? fmt.date(a.signedAt) : t.agreements.notSigned],
                  [t.agreements.source, t.agreements.sources[a.source]],
                  ...(a.fileName ? ([[t.agreements.originalFile, a.fileName]] as [string, ReactNode][]) : []),
                ]}
              />
            </Card>
            <AgreementDocument agreement={a} />
          </div>
        </>
      )}
    </Loaded>
  );
}

// ---------- export: a new agreement from a customer's details ----------

const input = `${select} w-full`;

function Labeled({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-muted">
        {label}
      </label>
      {children}
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

type Terms = {
  startDate: string;
  endDate: string;
  feeModel: FeeModel;
  percent: string;
  amount: string; // shekels: the fixed fee, or the monthly minimum
  plusVat: boolean;
  billing: "monthly" | "quarterly";
  threshold: string;
};

export const emptyTerms = (): Terms => ({ startDate: todayIso(), endDate: "", feeModel: "percent_of_rent", percent: "", amount: "", plusVat: false, billing: "monthly", threshold: "" });

/** Start, end, fee and approval threshold: the same inputs for a new agreement and an imported one. */
function TermsFields({ terms, set, hints = {} }: { terms: Terms; set: (patch: Partial<Terms>) => void; hints?: Partial<Record<keyof Terms | "fee", ReactNode>> }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Labeled id="ag-start" label={t.agreements.start} hint={hints.startDate}>
        <input id="ag-start" type="date" required className={input} value={terms.startDate} onChange={(e) => set({ startDate: e.target.value })} />
      </Labeled>
      <Labeled id="ag-end" label={t.agreements.end} hint={hints.endDate ?? t.agreements.endHelp}>
        <input id="ag-end" type="date" min={terms.startDate} className={input} value={terms.endDate} onChange={(e) => set({ endDate: e.target.value })} />
      </Labeled>
      <Labeled id="ag-model" label={t.agreements.feeModel} hint={hints.fee}>
        <select id="ag-model" className={input} value={terms.feeModel} onChange={(e) => set({ feeModel: e.target.value as FeeModel })}>
          {FEE_MODELS.map((m) => (
            <option key={m} value={m}>
              {t.agreements.feeModels[m]}
            </option>
          ))}
        </select>
      </Labeled>
      {terms.feeModel !== "fixed" && (
        <Labeled id="ag-percent" label={t.agreements.feePercentLabel}>
          <input id="ag-percent" type="number" required min={0} max={100} step="any" className={input} value={terms.percent} onChange={(e) => set({ percent: e.target.value })} />
        </Labeled>
      )}
      {terms.feeModel !== "percent_of_rent" && (
        <Labeled id="ag-amount" label={terms.feeModel === "fixed" ? t.agreements.feeAmount : t.agreements.feeMinimum}>
          <input id="ag-amount" type="number" required min={0} step="any" className={input} value={terms.amount} onChange={(e) => set({ amount: e.target.value })} />
        </Labeled>
      )}
      <Labeled id="ag-billing" label={t.agreements.billing} hint={hints.billing}>
        <select id="ag-billing" className={input} value={terms.billing} onChange={(e) => set({ billing: e.target.value as Terms["billing"] })}>
          {(["monthly", "quarterly"] as const).map((b) => (
            <option key={b} value={b}>
              {t.agreements.billings[b]}
            </option>
          ))}
        </select>
      </Labeled>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input type="checkbox" checked={terms.plusVat} onChange={(e) => set({ plusVat: e.target.checked })} />
        {t.agreements.plusVatLabel}
      </label>
      <Labeled id="ag-threshold" label={t.agreements.approvalThreshold} hint={hints.threshold}>
        <input id="ag-threshold" type="number" min={0} step="any" className={input} value={terms.threshold} onChange={(e) => set({ threshold: e.target.value })} />
      </Labeled>
    </div>
  );
}

const termsInput = (terms: Terms) => ({
  startDate: terms.startDate,
  endDate: terms.endDate || undefined,
  feeModel: terms.feeModel,
  feeMinor: terms.feeModel === "percent_of_rent" ? undefined : toMinor(terms.amount),
  feePercent: terms.feeModel === "fixed" ? undefined : terms.percent.trim() ? Number(terms.percent) : NaN,
  plusVat: terms.plusVat,
  billingFrequency: terms.billing,
  approvalThresholdMinor: terms.threshold ? toMinor(terms.threshold) : undefined,
});

export function NewAgreement() {
  const [params] = useSearchParams();
  const customerId = params.get("customer") ?? "";
  const { t } = useI18n();
  const navigate = useNavigate();
  const client = useQueryClient();
  const customer = useQuery({ queryKey: ["customer", customerId], queryFn: () => getCustomer(customerId) });
  const [terms, setTerms] = useState<Terms>(emptyTerms);
  const [propertyIds, setPropertyIds] = useState<string[] | undefined>();
  const [language, setLanguage] = useState<Language | undefined>();
  const draftInput = (c: { id: string; preferredLanguage: Language }, propertyIds: string[]) => ({
    customerId: c.id,
    propertyIds,
    language: language ?? c.preferredLanguage,
    ...termsInput(terms),
  });
  const create = useMutation({
    mutationFn: (input: Parameters<typeof createAgreement>[0]) => createAgreement(input),
    onSuccess: async (a) => {
      await client.invalidateQueries();
      navigate(`/agreements/${a.id}`);
    },
  });

  return (
    <Loaded query={customer}>
      {({ customer: c, properties }) => {
        // Top-level properties only: a complex in the agreement covers its buildings and units.
        const own = properties.filter((p) => p.depth === 0);
        const chosen = propertyIds ?? own.map((p) => p.id);
        const draft = draftInput(c, chosen);
        return (
          <>
            <PageHeader title={t.agreements.newFor(c.name)} />
            <Card>
              <form
                className="space-y-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  create.mutate(draft);
                }}
              >
                <fieldset>
                  <legend className="mb-2 text-xs font-semibold text-muted">{t.agreements.customerProperties}</legend>
                  {own.length ? (
                    <ul className="space-y-1">
                      {own.map((p) => (
                        <li key={p.id}>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={chosen.includes(p.id)}
                              onChange={(e) => setPropertyIds(e.target.checked ? [...chosen, p.id] : chosen.filter((x) => x !== p.id))}
                            />
                            {`${propertyLabel(p)}, ${p.city}`}
                          </label>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted">{t.agreements.noProperties}</p>
                  )}
                </fieldset>
                <TermsFields terms={terms} set={(patch) => setTerms((x) => ({ ...x, ...patch }))} />
                <Labeled id="ag-language" label={t.agreements.language}>
                  <select id="ag-language" className={select} value={language ?? c.preferredLanguage} onChange={(e) => setLanguage(e.target.value as Language)}>
                    {(["he", "en"] as const).map((l) => (
                      <option key={l} value={l}>
                        {LANGUAGE_NAMES[l]}
                      </option>
                    ))}
                  </select>
                </Labeled>
                <NewAgreementChecks input={draft} />
                {create.isError && <SaveError error={create.error} />}
                <button type="submit" className={primary} disabled={create.isPending}>
                  {t.agreements.create}
                </button>
              </form>
            </Card>
          </>
        );
      }}
    </Loaded>
  );
}

function NewAgreementChecks({ input }: { input: Parameters<typeof checkNewAgreement>[0] }) {
  const checks = useQuery({ queryKey: ["agreement-checks", input], queryFn: () => checkNewAgreement(input) });
  return <ChecksPanel checks={checks.data} />;
}

// ---------- import: a customer from an existing agreement ----------

type Owner = { kind: PartyKind; name: string; taxId: string; phone: string; email: string; billingAddress: string; preferredLanguage: Language };

/** Where a value came from, under its input. */
function Source({ found }: { found?: Found<unknown> }) {
  const { t } = useI18n();
  if (!found) return <span className="text-amber-800">{t.agreements.notFound}</span>;
  return (
    <span>
      {found.how === "label" ? t.agreements.foundIn : `${t.agreements.guessed}:`} <q className="text-slate-600">{found.line}</q>
    </span>
  );
}

function ReviewImport({ extract, text, fileName }: { extract: AgreementExtract; text: string; fileName?: string }) {
  const { t, fmt } = useI18n();
  const navigate = useNavigate();
  const client = useQueryClient();
  const x = extract.customer;
  const [owner, setOwner] = useState<Owner>({
    kind: x.kind.value,
    name: x.name?.value ?? "",
    taxId: x.taxId?.value ?? "",
    phone: x.phone ? fmt.phone(x.phone.value) : "",
    email: x.email?.value ?? "",
    billingAddress: x.billingAddress?.value ?? "",
    preferredLanguage: extract.language,
  });
  const set = (patch: Partial<Owner>) => setOwner((o) => ({ ...o, ...patch }));
  const term = extract.terms;
  const [terms, setTerms] = useState<Terms>({
    startDate: term.startDate?.value ?? "",
    endDate: term.endDate?.value ?? "",
    feeModel: term.feeModel?.value ?? "percent_of_rent",
    percent: term.feePercent ? String(term.feePercent.value) : "",
    amount: term.feeMinor ? String(term.feeMinor.value / 100) : "",
    plusVat: Boolean(term.plusVat?.value),
    billing: term.billingFrequency?.value ?? "monthly",
    threshold: term.approvalThresholdMinor ? String(term.approvalThresholdMinor.value / 100) : "",
  });
  const [signed, setSigned] = useState(true);

  const phone = normalizePhone(owner.phone);
  const matches = useQuery({
    queryKey: ["customer-matches", owner.taxId, owner.email, phone],
    queryFn: () => findCustomerMatches({ taxId: owner.taxId, email: owner.email, phone }),
  });
  const [choice, setChoice] = useState<string | undefined>(); // a customer id, or "new"
  const linkTo = choice ?? matches.data?.[0]?.customer.id ?? "new";

  const places = useQuery({
    queryKey: ["property-matches", extract.properties.map((p) => p.value)],
    queryFn: () => matchProperties(extract.properties.map((p) => p.value)),
  });
  const [excluded, setExcluded] = useState<string[]>([]);
  const propertyIds = [...new Set((places.data ?? []).flatMap((m) => (m.property && !excluded.includes(m.property.id) ? [m.property.id] : [])))];

  const importInput = {
    customer: {
      kind: owner.kind,
      name: owner.name,
      // Kept as typed (a passport may have letters); the data layer stores digits only for Israeli IDs.
      taxId: owner.taxId.trim() || undefined,
      phone: owner.phone,
      email: owner.email.trim() || undefined,
      billingAddress: owner.billingAddress.trim() || undefined,
      preferredLanguage: owner.preferredLanguage,
    },
    existingCustomerId: linkTo === "new" ? undefined : linkTo,
    agreement: {
      ...termsInput(terms),
      propertyIds,
      language: extract.language,
      fileName,
      signedAt: signed ? (terms.startDate && terms.startDate < todayIso() ? terms.startDate : todayIso()) : undefined,
    },
    unmatchedAddresses: (places.data ?? []).filter((m) => !m.property).map((m) => m.text),
  };
  const checks = useQuery({ queryKey: ["import-checks", importInput], queryFn: () => checkAgreementImport(importInput) });
  const blocked = !checks.data || hasErrors(checks.data);
  const save = useMutation({
    mutationFn: () => importAgreement(importInput),
    onSuccess: async (result) => {
      await client.invalidateQueries();
      const filled = result.filled.map((k) => (k === "taxId" ? t.customers.taxId : k === "email" ? t.common.email : t.customers.billingAddress)).join(", ");
      navigate(`/agreements/${result.agreementId}`, { state: { notice: t.agreements.imported(filled) } });
    },
  });

  // What an AI model would receive if AI-assisted reading is enabled later (docs/SECURITY.md).
  const redacted = redact(text, [
    ...(owner.name ? [{ kind: "NAME" as const, value: owner.name }] : []),
    ...(owner.billingAddress ? [{ kind: "ADDRESS" as const, value: owner.billingAddress }] : []),
  ]);

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      {extract.warnings.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900" role="status">
          {extract.warnings.map((w) => (
            <li key={w}>{t.agreements.warnings[w]}</li>
          ))}
        </ul>
      )}

      <Card title={t.agreements.step2}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled id="im-name" label={t.common.name} hint={<Source found={x.name} />}>
            <input id="im-name" required className={input} value={owner.name} onChange={(e) => set({ name: e.target.value })} />
          </Labeled>
          <Labeled id="im-kind" label={t.properties.kind} hint={<Source found={x.kind.line ? x.kind : undefined} />}>
            <select id="im-kind" className={input} value={owner.kind} onChange={(e) => set({ kind: e.target.value as PartyKind })}>
              {(["individual", "company"] as const).map((k) => (
                <option key={k} value={k}>
                  {t.kinds[k]}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled id="im-tax" label={t.customers.taxId} hint={<Source found={x.taxId} />}>
            <input id="im-tax" dir="ltr" inputMode="numeric" autoComplete="off" className={input} value={owner.taxId} onChange={(e) => set({ taxId: e.target.value })} />
          </Labeled>
          <Labeled id="im-phone" label={t.common.phone} hint={<Source found={x.phone} />}>
            <input id="im-phone" dir="ltr" type="tel" required className={input} value={owner.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Labeled>
          <Labeled id="im-email" label={t.common.email} hint={<Source found={x.email} />}>
            <input id="im-email" dir="ltr" type="email" className={input} value={owner.email} onChange={(e) => set({ email: e.target.value })} />
          </Labeled>
          <Labeled id="im-address" label={t.customers.billingAddress} hint={<Source found={x.billingAddress} />}>
            <input id="im-address" className={input} value={owner.billingAddress} onChange={(e) => set({ billingAddress: e.target.value })} />
          </Labeled>
          <Labeled id="im-lang" label={t.customers.preferredLanguage}>
            <select id="im-lang" className={input} value={owner.preferredLanguage} onChange={(e) => set({ preferredLanguage: e.target.value as Language })}>
              {(["he", "en"] as const).map((l) => (
                <option key={l} value={l}>
                  {LANGUAGE_NAMES[l]}
                </option>
              ))}
            </select>
          </Labeled>
        </div>

        {!!matches.data?.length && (
          <fieldset className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <legend className="px-1 text-sm font-bold text-amber-900">{t.agreements.match.title}</legend>
            <ul className="space-y-2 text-sm">
              {matches.data.map((m) => (
                <li key={m.customer.id}>
                  <label className="flex items-start gap-2">
                    <input type="radio" name="link" checked={linkTo === m.customer.id} onChange={() => setChoice(m.customer.id)} className="mt-1" />
                    <span>
                      {t.agreements.match.link(m.customer.name)}
                      <span className="ms-2 text-xs text-muted">{t.agreements.match.by[m.by]}</span>
                    </span>
                  </label>
                </li>
              ))}
              <li>
                <label className="flex items-center gap-2">
                  <input type="radio" name="link" checked={linkTo === "new"} onChange={() => setChoice("new")} />
                  {t.agreements.match.createNew}
                </label>
              </li>
            </ul>
          </fieldset>
        )}
      </Card>

      <Card title={t.agreements.step3}>
        <TermsFields
          terms={terms}
          set={(patch) => setTerms((x) => ({ ...x, ...patch }))}
          hints={{
            startDate: <Source found={term.startDate} />,
            endDate: term.endDate && <Source found={term.endDate} />,
            fee: <Source found={term.feeModel} />,
            billing: term.billingFrequency && <Source found={term.billingFrequency} />,
            threshold: <Source found={term.approvalThresholdMinor} />,
          }}
        />
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={signed} onChange={(e) => setSigned(e.target.checked)} />
          {t.agreements.signedAt}
        </label>

        <h3 className="mb-2 mt-5 text-xs font-semibold text-muted">{t.agreements.documentProperties}</h3>
        {places.data?.length ? (
          <ul className="space-y-1 text-sm">
            {places.data.map((m) => (
              <li key={m.text}>
                {m.property ? (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!excluded.includes(m.property.id)}
                      onChange={(e) => setExcluded(e.target.checked ? excluded.filter((id) => id !== m.property!.id) : [...excluded, m.property!.id])}
                    />
                    {m.text}
                    <Badge color="green">{t.agreements.matched}</Badge>
                  </label>
                ) : (
                  <span className="flex flex-wrap items-center gap-2">
                    {m.text}
                    <Badge color="amber">{t.agreements.unmatched}</Badge>
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t.agreements.noDocumentProperties}</p>
        )}
      </Card>

      <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="flex cursor-pointer items-center gap-2 font-bold text-brand-900">
          <Icon name="shield" className="h-5 w-5" />
          {t.security.redactedTitle}
          <Badge>{t.security.redactedCount(redacted.redactions.length)}</Badge>
        </summary>
        <p className="mb-3 mt-2 text-sm text-muted">{t.security.redactedHelp}</p>
        <pre lang={extract.language} dir={extract.language === "he" ? "rtl" : "ltr"} className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-xs">
          {redacted.text}
        </pre>
      </details>

      <ChecksPanel checks={checks.data} />
      {save.isError && <SaveError error={save.error} />}
      <button type="submit" className={primary} disabled={save.isPending || blocked}>
        {linkTo === "new" ? t.agreements.saveNew : t.agreements.saveLinked}
      </button>
    </form>
  );
}

export function ImportAgreement() {
  const { t } = useI18n();
  const organization = useQuery({ queryKey: ["organization"], queryFn: getOrganization });
  const [pasted, setPasted] = useState("");
  const [source, setSource] = useState<{ text: string; fileName?: string; extract: AgreementExtract; at: number }>();
  const [problem, setProblem] = useState<DocumentProblem>();
  const [reading, setReading] = useState(false);

  function read(text: string, fileName?: string) {
    if (!organization.data) return;
    if (!text.replace(/[\s_\-–—.]/g, "")) {
      setSource(undefined);
      setProblem("empty");
      return;
    }
    setProblem(undefined);
    setSource({ text, fileName, extract: extractAgreement(text, organization.data), at: Date.now() });
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setReading(true);
    try {
      read(await readDocumentFile(file), file.name);
    } catch (e) {
      setSource(undefined);
      setProblem(e instanceof DocumentError ? e.problem : "unreadable");
    } finally {
      setReading(false);
    }
  }

  return (
    <>
      <PageHeader title={t.agreements.importTitle} intro={t.agreements.importIntro} />
      <div className="space-y-6">
        <Card title={t.agreements.step1}>
          <p className="mb-4 flex items-start gap-2 rounded-lg bg-brand-50 px-4 py-2 text-sm text-brand-900">
            <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0" />
            {t.security.localOnly}
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <Labeled id="im-file" label={t.agreements.chooseFile} hint={t.agreements.fileHelp}>
              <input
                id="im-file"
                type="file"
                accept=".docx,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="block w-full text-sm file:me-3 file:rounded-full file:border-0 file:bg-brand-700 file:px-4 file:py-2 file:font-semibold file:text-white"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </Labeled>
            <div>
              <Labeled id="im-text" label={t.agreements.orPaste}>
                <textarea id="im-text" rows={5} className={input} value={pasted} onChange={(e) => setPasted(e.target.value)} />
              </Labeled>
              <button type="button" className={`${secondary} mt-2`} disabled={!pasted.trim() || !organization.data} onClick={() => read(pasted)}>
                {t.agreements.read}
              </button>
            </div>
          </div>
          {reading && <p role="status" className="mt-3 text-sm text-muted">{t.agreements.reading}</p>}
          {problem && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {t.agreements.problems[problem]}
            </p>
          )}
          {source?.fileName && <p className="mt-3 text-sm text-muted">{t.agreements.readFrom(source.fileName)}</p>}
        </Card>
        {/* A new reading starts a fresh review. */}
        {source && <ReviewImport key={source.at} extract={source.extract} text={source.text} fileName={source.fileName} />}
      </div>
    </>
  );
}
