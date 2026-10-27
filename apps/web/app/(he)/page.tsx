import { Landing } from "@/components/Landing";
import { dictionaries, pageMetadata } from "@/components/metadata";

export const metadata = pageMetadata("he");

export default function Home() {
  return <Landing locale="he" t={dictionaries.he} />;
}
