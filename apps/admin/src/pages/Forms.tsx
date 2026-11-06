import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Icon } from "@/components/icons";
import { Badge, Card, EntityLink, Loaded, PageHeader, Table, Td } from "@/components/ui";
import { getFormTemplate, getFormValues, listFormRecords, listFormTemplates, saveFormTemplate } from "@/data/api";
import { FIELDS, render, toBlocks, type Block } from "@/data/templates";
import type { FormContext, FormTemplate, Language } from "@/domain/types";
import { useI18n } from "@/i18n";
import { select } from "./Professionals";

const LANGUAGES: Language[] = ["he", "en"];
const LANGUAGE_NAMES: Record<Language, string> = { he: "עברית", en: "English" };
const CONTEXTS: FormContext[] = ["lease", "property", "customer", "tenant", "issue", "payment_request"];
const primary = "inline-flex items-center gap-2 rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50";

export function Forms() {
  const { t, fmt } = useI18n();
  const query = useQuery({ queryKey: ["form-templates"], queryFn: listFormTemplates });
  return (
    <>
      <PageHeader
        title={t.forms.title}
        intro={t.forms.intro}
        actions={
          <Link to="/forms/new" className={primary}>
            {t.forms.newTemplate}
          </Link>
        }
      />
      <Loaded query={query}>
        {(rows) =>
          (["document", "message"] as const).map((kind) => (
            <section key={kind} className="mb-8">
              <h2 className="mb-3 font-bold text-brand-900">{kind === "document" ? t.forms.documents : t.forms.messages}</h2>
              <Table head={[t.forms.name, t.forms.context, t.forms.languages, t.forms.updated]}>
                {rows
                  .filter((r) => r.kind === kind)
                  .map((r) => (
                    <tr key={r.id}>
                      <Td>
                        <EntityLink to={`/forms/${r.id}`}>{r.name}</EntityLink>
                      </Td>
                      <Td>{t.forms.contexts[r.context]}</Td>
                      <Td>
                        <div className="flex gap-1">
                          {LANGUAGES.filter((l) => r.body[l]).map((l) => (
                            <Badge key={l}>{LANGUAGE_NAMES[l]}</Badge>
                          ))}
                        </div>
                      </Td>
                      <Td className="text-muted">{fmt.date(r.updatedAt)}</Td>
                    </tr>
                  ))}
              </Table>
            </section>
          ))
        }
      </Loaded>
    </>
  );
}

/** The printable form: headings, bullets, checkboxes and blanks from the rendered text. */
function FormDocument({ blocks }: { blocks: Block[] }) {
  return (
    <article className="space-y-2 leading-relaxed">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "title":
            return <h2 key={i} className="mb-3 text-center text-2xl font-bold">{b.text}</h2>;
          case "section":
            return <h3 key={i} className="mt-5 border-b border-slate-300 pb-1 font-bold">{b.text}</h3>;
          case "bullet":
            return <p key={i} className="ps-4 before:me-2 before:content-['•']">{b.text}</p>;
          case "checkbox":
            return (
              <p key={i} className="flex items-center gap-2">
                <span aria-hidden="true" className="inline-block h-4 w-4 shrink-0 border border-slate-500" />
                {b.text}
              </p>
            );
          case "divider":
            return <hr key={i} className="my-6 border-slate-300" />;
          default:
            return <p key={i}>{b.text}</p>;
        }
      })}
    </article>
  );
}

function Generate({ template }: { template: FormTemplate }) {
  const { t, locale } = useI18n();
  const [recordId, setRecordId] = useState("");
  const available = LANGUAGES.filter((l) => template.body[l]?.trim());
  const [language, setLanguage] = useState<Language>(available.includes(locale) ? locale : (available[0] ?? "he"));
  const records = useQuery({ queryKey: ["form-records", template.context], queryFn: () => listFormRecords(template.context) });
  const values = useQuery({
    queryKey: ["form-values", template.context, recordId, language],
    queryFn: () => getFormValues(template.context, recordId, language),
    enabled: !!recordId,
  });
  const body = template.body[language] ?? "";
  const result = values.data && render(body, template.context, values.data);
  const fieldNames = (keys: string[]) => keys.map((k) => t.forms.fieldLabels[k] ?? k).join(", ");

  return (
    <Card title={t.forms.generate}>
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <label htmlFor="gen-record" className="block text-xs font-semibold text-muted">
            {t.forms.contexts[template.context]}
          </label>
          <select id="gen-record" className={`${select} w-full`} value={recordId} onChange={(e) => setRecordId(e.target.value)}>
            <option value="">{t.forms.chooseRecord}</option>
            {records.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="gen-lang" className="block text-xs font-semibold text-muted">
            {t.forms.language}
          </label>
          <select id="gen-lang" className={select} value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
            {available.map((l) => (
              <option key={l} value={l}>
                {LANGUAGE_NAMES[l]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {result && (
        <>
          {(result.missing.length > 0 || result.unknown.length > 0) && (
            <div className="mb-4 space-y-1 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900" role="status">
              {result.missing.length > 0 && <p>{t.forms.missing(fieldNames(result.missing))}</p>}
              {result.unknown.length > 0 && <p>{t.forms.unknown(result.unknown.join(", "))}</p>}
            </div>
          )}
          <div className="mb-3 flex justify-end">
            <button type="button" className={primary} onClick={() => window.print()}>
              <Icon name="print" className="h-4 w-4" />
              {t.forms.print}
            </button>
          </div>
          {/* The form follows its own language and direction, whatever the app language is. */}
          <div
            lang={language}
            dir={language === "he" ? "rtl" : "ltr"}
            className="print-area rounded-xl border border-slate-200 bg-white p-6 sm:p-10"
          >
            {template.kind === "document" ? <FormDocument blocks={toBlocks(result.text)} /> : <p className="whitespace-pre-line">{result.text}</p>}
          </div>
        </>
      )}
    </Card>
  );
}

type DraftProps = { draft: FormTemplate; setDraft: (update: (d: FormTemplate) => FormTemplate) => void; isNew: boolean };

function Editor({ draft, setDraft, isNew }: DraftProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [language, setLanguage] = useState<Language>("he");
  const textarea = useRef<HTMLTextAreaElement>(null);
  const save = useMutation({
    mutationFn: () => saveFormTemplate(isNew ? { ...draft, id: undefined } : draft),
    onSuccess: async (saved) => {
      await client.invalidateQueries({ queryKey: ["form-templates"] });
      await client.invalidateQueries({ queryKey: ["form-template", saved.id] });
      if (isNew) navigate(`/forms/${saved.id}`, { replace: true });
    },
  });

  const setBody = (text: string) => setDraft((d) => ({ ...d, body: { ...d.body, [language]: text } }));

  /** Inserts {{field}} at the cursor and puts the cursor after it. */
  function insert(key: string) {
    const el = textarea.current;
    const text = draft.body[language] ?? "";
    const token = `{{${key}}}`;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    setBody(text.slice(0, start) + token + text.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <Card>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label htmlFor="tpl-name" className="block text-xs font-semibold text-muted">
              {t.forms.name}
            </label>
            <input
              id="tpl-name"
              required
              className={`${select} w-full`}
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="tpl-kind" className="block text-xs font-semibold text-muted">
              {t.forms.kind}
            </label>
            <select id="tpl-kind" className={`${select} w-full`} value={draft.kind} onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as FormTemplate["kind"] }))}>
              {(["document", "message"] as const).map((k) => (
                <option key={k} value={k}>
                  {t.forms.kinds[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tpl-context" className="block text-xs font-semibold text-muted">
              {t.forms.context}
            </label>
            <select
              id="tpl-context"
              className={`${select} w-full`}
              value={draft.context}
              onChange={(e) => setDraft((d) => ({ ...d, context: e.target.value as FormContext }))}
            >
              {CONTEXTS.map((c) => (
                <option key={c} value={c}>
                  {t.forms.contexts[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tpl-lang" className="block text-xs font-semibold text-muted">
              {t.forms.languages}
            </label>
            <select id="tpl-lang" className={`${select} w-full`} value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {LANGUAGE_NAMES[l]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
          <div>
            <label htmlFor="tpl-body" className="block text-xs font-semibold text-muted">
              {t.forms.body(LANGUAGE_NAMES[language])}
            </label>
            <textarea
              id="tpl-body"
              ref={textarea}
              rows={18}
              lang={language}
              dir={language === "he" ? "rtl" : "ltr"}
              className={`${select} w-full font-mono leading-relaxed`}
              value={draft.body[language] ?? ""}
              onChange={(e) => setBody(e.target.value)}
              aria-describedby="tpl-syntax"
            />
            <p id="tpl-syntax" className="mt-1 text-xs text-muted">
              {t.forms.syntax}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted">{t.forms.fields}</p>
            <p className="mb-2 text-xs text-muted">{t.forms.fieldsHelp}</p>
            <ul className="flex max-h-96 flex-wrap gap-1.5 overflow-y-auto lg:flex-col lg:flex-nowrap">
              {FIELDS[draft.context].map((key) => (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => insert(key)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-start text-xs hover:border-brand-300 hover:bg-brand-50"
                  >
                    <span className="font-semibold">{t.forms.fieldLabels[key] ?? key}</span>
                    <span dir="ltr" className="block text-muted">{`{{${key}}}`}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className={primary} disabled={save.isPending}>
            {t.forms.save}
          </button>
          {save.isSuccess && (
            <span className="text-sm text-emerald-800" role="status">
              {t.forms.saved}
            </span>
          )}
          <span className="text-xs text-muted">{t.forms.sampleNote}</span>
        </div>
      </form>
    </Card>
  );
}

/** Editing on one side, a live preview of the unsaved draft on the other. */
function TemplateWorkspace({ initial, isNew }: { initial: FormTemplate; isNew: boolean }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(initial);
  return (
    <>
      <PageHeader title={draft.name} intro={`${t.forms.kinds[draft.kind]} · ${t.forms.contexts[draft.context]}`} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Editor draft={draft} setDraft={setDraft} isNew={isNew} />
        {/* Re-mount when the record type changes, so the chosen record always matches it. */}
        <Generate key={draft.context} template={draft} />
      </div>
    </>
  );
}

export function FormEditor() {
  const { id = "" } = useParams();
  const { t } = useI18n();
  const isNew = id === "new";
  const query = useQuery({
    queryKey: ["form-template", id],
    queryFn: () =>
      isNew
        ? Promise.resolve<FormTemplate>({ id: "new", name: t.forms.newName, context: "lease", kind: "document", body: { he: "" }, updatedAt: "" })
        : getFormTemplate(id),
  });

  return (
    <Loaded query={query}>{(template) => <TemplateWorkspace key={template.id} initial={template} isNew={isNew} />}</Loaded>
  );
}
