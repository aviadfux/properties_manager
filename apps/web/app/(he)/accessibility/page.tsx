import { LegalPage } from "@/components/LegalPage";
import { dictionaries, pageMetadata } from "@/components/metadata";

const t = dictionaries.he;
export const metadata = pageMetadata("he", "accessibility/", t.legal.accessibility.title);

export default function Page() {
  return <LegalPage locale="he" t={t} doc={t.legal.accessibility} />;
}
