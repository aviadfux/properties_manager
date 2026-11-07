import { useState } from "react";
import { useI18n } from "@/i18n";
import { mask } from "@/security/sensitive";
import { Ltr } from "./ui";

/**
 * An identifying number (ID, company number) shown masked until the user asks to see it, so it is
 * not exposed on a shared screen or in a screenshot. With the backend, revealing it is logged.
 */
export function SensitiveValue({ value }: { value?: string }) {
  const { t } = useI18n();
  const [shown, setShown] = useState(false);
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <Ltr>{shown ? value : mask(value)}</Ltr>
      <button
        type="button"
        onClick={() => setShown(!shown)}
        aria-pressed={shown}
        className="rounded px-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
      >
        {shown ? t.security.hide : t.security.show}
      </button>
    </span>
  );
}
