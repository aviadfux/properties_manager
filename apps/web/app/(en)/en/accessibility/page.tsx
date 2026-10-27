import { LegalPage } from "@/components/LegalPage";
import { dictionaries, pageMetadata } from "@/components/metadata";

const t = dictionaries.en;
export const metadata = pageMetadata("en", "accessibility/", t.legal.accessibility.title);

export default function Page() {
  return <LegalPage locale="en" t={t} doc={t.legal.accessibility} />;
}
