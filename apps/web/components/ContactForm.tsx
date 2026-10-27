"use client";

import { useState, type FormEvent } from "react";
import type { Dictionary } from "@/content/types";
import { whatsappLink } from "@/site.config";
import { WhatsAppIcon } from "./icons";

type Fields = { name: string; phone: string; propertyType: string; city: string; message: string };
type Errors = Partial<Record<keyof Fields, string>>;

// Until the system has a server, the form builds a WhatsApp message instead of submitting
// anywhere (spec §2 "Public Website"): nothing is stored, the visitor decides whether to send.
export function ContactForm({ t }: { t: Dictionary["contact"]["form"] }) {
  const [fields, setFields] = useState<Fields>({ name: "", phone: "", propertyType: "", city: "", message: "" });
  const [errors, setErrors] = useState<Errors>({});

  function validate(f: Fields): Errors {
    const e: Errors = {};
    if (!f.name.trim()) e.name = t.required;
    if (!f.phone.trim()) e.phone = t.required;
    else if (f.phone.replace(/\D/g, "").length < 9) e.phone = t.invalidPhone;
    return e;
  }

  function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const e = validate(fields);
    setErrors(e);
    if (Object.keys(e).length) {
      document.getElementById(`cf-${Object.keys(e)[0]}`)?.focus();
      return;
    }
    const lines = [
      t.whatsappIntro,
      `${t.name}: ${fields.name}`,
      `${t.phone}: ${fields.phone}`,
      fields.propertyType && `${t.propertyType}: ${fields.propertyType}`,
      fields.city && `${t.city}: ${fields.city}`,
      fields.message && fields.message,
    ].filter(Boolean);
    window.open(whatsappLink(lines.join("\n")), "_blank", "noopener");
  }

  const set = (k: keyof Fields) => (ev: { target: { value: string } }) =>
    setFields({ ...fields, [k]: ev.target.value });

  const input =
    "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-ink shadow-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200 aria-[invalid=true]:border-red-700";

  function errorText(id: keyof Fields) {
    return errors[id] ? (
      <p id={`cf-${id}-error`} className="mt-1 text-sm font-medium text-red-700">
        {errors[id]}
      </p>
    ) : null;
  }

  const describedBy = (k: keyof Fields) => (errors[k] ? `cf-${k}-error` : undefined);

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="cf-name" className="text-sm font-semibold">
          {t.name}
        </label>
        <input id="cf-name" name="name" autoComplete="name" required aria-invalid={!!errors.name}
          aria-describedby={describedBy("name")} value={fields.name} onChange={set("name")} className={input} />
        {errorText("name")}
      </div>
      <div>
        <label htmlFor="cf-phone" className="text-sm font-semibold">
          {t.phone}
        </label>
        <input id="cf-phone" name="phone" type="tel" dir="ltr" autoComplete="tel" required aria-invalid={!!errors.phone}
          aria-describedby={describedBy("phone")} value={fields.phone} onChange={set("phone")}
          className={`${input} text-start`} />
        {errorText("phone")}
      </div>
      <div>
        <label htmlFor="cf-propertyType" className="text-sm font-semibold">
          {t.propertyType} <span className="font-normal text-muted">{t.optional}</span>
        </label>
        <select id="cf-propertyType" name="propertyType" value={fields.propertyType} onChange={set("propertyType")} className={input}>
          <option value="">—</option>
          {t.propertyTypes.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="cf-city" className="text-sm font-semibold">
          {t.city} <span className="font-normal text-muted">{t.optional}</span>
        </label>
        <input id="cf-city" name="city" autoComplete="address-level2" value={fields.city} onChange={set("city")} className={input} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="cf-message" className="text-sm font-semibold">
          {t.message} <span className="font-normal text-muted">{t.optional}</span>
        </label>
        <textarea id="cf-message" name="message" rows={4} value={fields.message} onChange={set("message")} className={input} />
      </div>
      <div className="sm:col-span-2">
        <button type="submit"
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-700 px-6 py-3 font-semibold text-white hover:bg-brand-800 sm:w-auto">
          <WhatsAppIcon className="h-5 w-5" />
          {t.submit}
        </button>
        <p className="mt-3 text-sm text-muted">{t.note}</p>
      </div>
    </form>
  );
}
