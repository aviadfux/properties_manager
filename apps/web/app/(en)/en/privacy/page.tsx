import { LegalPage } from "@/components/LegalPage";
import { dictionaries, pageMetadata } from "@/components/metadata";

const t = dictionaries.en;
export const metadata = pageMetadata("en", "privacy/", t.legal.privacy.title);

export default function Page() {
  return <LegalPage locale="en" t={t} doc={t.legal.privacy} />;
}
