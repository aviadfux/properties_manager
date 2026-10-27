import { LegalPage } from "@/components/LegalPage";
import { dictionaries, pageMetadata } from "@/components/metadata";

const t = dictionaries.he;
export const metadata = pageMetadata("he", "privacy/", t.legal.privacy.title);

export default function Page() {
  return <LegalPage locale="he" t={t} doc={t.legal.privacy} />;
}
