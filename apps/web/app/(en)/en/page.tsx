import { Landing } from "@/components/Landing";
import { dictionaries, pageMetadata } from "@/components/metadata";

export const metadata = pageMetadata("en");

export default function Home() {
  return <Landing locale="en" t={dictionaries.en} />;
}
